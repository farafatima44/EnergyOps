using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using EnergyOps.Api.Data;
using EnergyOps.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnergyOps.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BillingController : ControllerBase
    {
        private readonly AppDbContext _db;

        public BillingController(AppDbContext db)
        {
            _db = db;
        }

        // Generate (or update) invoices for all units in a property for a given month (YYYY-MM)
        [HttpPost("generate")]
        public async Task<ActionResult<object>> Generate([FromQuery] Guid propertyId, [FromQuery] string month)
        {
            if (propertyId == Guid.Empty)
                return BadRequest("propertyId is required.");

            if (string.IsNullOrWhiteSpace(month))
                return BadRequest("month is required in format YYYY-MM.");

            if (!DateTime.TryParseExact(
                    month + "-01",
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var monthStart))
            {
                return BadRequest("month must be in format YYYY-MM.");
            }

            // Important: do NOT force UTC kind here because your stored timestamps are kind-unspecified
            var start = new DateTime(monthStart.Year, monthStart.Month, 1, 0, 0, 0);
            var end = start.AddMonths(1);

            var units = await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .ToListAsync();

            if (units.Count == 0)
                return NotFound("No units found for this property.");

            int generated = 0;
            int updated = 0;
            int skippedNoPlan = 0;

            foreach (var unit in units)
            {
                if (unit.RatePlanId == null)
                {
                    skippedNoPlan++;
                    continue;
                }

                var plan = await _db.RatePlans.FirstOrDefaultAsync(r => r.Id == unit.RatePlanId.Value);
                if (plan == null)
                {
                    skippedNoPlan++;
                    continue;
                }

                // Compute usage for the month
                var totalUsageDouble = await _db.MeterReadings
                    .Where(r => r.UnitId == unit.Id && r.Timestamp >= start && r.Timestamp < end)
                    .Select(r => (double)r.UsageKwh)
                    .SumAsync();

                var totalUsage = (decimal)totalUsageDouble;
                var totalAmount = (totalUsage * plan.RatePerKwh) + plan.FixedFee;

                // Upsert invoice (update if exists, else create)
                var existing = await _db.Invoices
                    .FirstOrDefaultAsync(i => i.UnitId == unit.Id && i.BillingMonth == month);

                if (existing != null)
                {
                    existing.TotalUsageKwh = Math.Round(totalUsage, 2);
                    existing.RatePerKwhSnapshot = plan.RatePerKwh;
                    existing.FixedFeeSnapshot = plan.FixedFee;
                    existing.TotalAmount = Math.Round(totalAmount, 2);
                    existing.Status = "Draft";
                    existing.GeneratedAt = DateTime.UtcNow;

                    updated++;
                    continue;
                }

                var invoice = new Invoice
                {
                    UnitId = unit.Id,
                    BillingMonth = month,
                    TotalUsageKwh = Math.Round(totalUsage, 2),
                    RatePerKwhSnapshot = plan.RatePerKwh,
                    FixedFeeSnapshot = plan.FixedFee,
                    TotalAmount = Math.Round(totalAmount, 2),
                    Status = "Draft",
                    GeneratedAt = DateTime.UtcNow
                };

                _db.Invoices.Add(invoice);
                generated++;
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                propertyId,
                month,
                generated,
                updated,
                skippedNoPlan
            });
        }

        // Get invoice for one unit + month (YYYY-MM)
        [HttpGet("unit/{unitId:guid}")]
        public async Task<ActionResult<Invoice>> GetInvoiceForUnit([FromQuery] string month, Guid unitId)
        {
            if (string.IsNullOrWhiteSpace(month))
                return BadRequest("month is required in format YYYY-MM.");

            var invoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.UnitId == unitId && i.BillingMonth == month);

            if (invoice == null)
                return NotFound("Invoice not found.");

            return Ok(invoice);
        }

        // Debug usage calculation for one unit + month (YYYY-MM)
        [HttpGet("debug-usage/unit/{unitId:guid}")]
        public async Task<ActionResult<object>> DebugUsage([FromQuery] string month, Guid unitId)
        {
            if (string.IsNullOrWhiteSpace(month))
                return BadRequest("month is required in format YYYY-MM.");

            if (!DateTime.TryParseExact(
                    month + "-01",
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var monthStart))
            {
                return BadRequest("month must be in format YYYY-MM.");
            }

            var start = new DateTime(monthStart.Year, monthStart.Month, 1, 0, 0, 0);
            var end = start.AddMonths(1);

            var count = await _db.MeterReadings
                .Where(r => r.UnitId == unitId && r.Timestamp >= start && r.Timestamp < end)
                .CountAsync();

            var sumDouble = await _db.MeterReadings
                .Where(r => r.UnitId == unitId && r.Timestamp >= start && r.Timestamp < end)
                .Select(r => (double)r.UsageKwh)
                .SumAsync();

            return Ok(new
            {
                unitId,
                month,
                start,
                end,
                count,
                sum = sumDouble
            });
        }

        // Optional: delete invoice for one unit + month (YYYY-MM)
        [HttpDelete("unit/{unitId:guid}")]
        public async Task<ActionResult<object>> DeleteInvoiceForUnit([FromQuery] string month, Guid unitId)
        {
            if (string.IsNullOrWhiteSpace(month))
                return BadRequest("month is required in format YYYY-MM.");

            var invoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.UnitId == unitId && i.BillingMonth == month);

            if (invoice == null)
                return NotFound("Invoice not found.");

            _db.Invoices.Remove(invoice);
            await _db.SaveChangesAsync();

            return Ok(new { deleted = true, unitId, month });
        }
    }
}
