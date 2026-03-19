using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using EnergyOps.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnergyOps.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _db;

        public DashboardController(AppDbContext db)
        {
            _db = db;
        }

        // GET /api/Dashboard/property/{propertyId}/daily?month=YYYY-MM
        [HttpGet("property/{propertyId:guid}/daily")]
        public async Task<ActionResult<object>> GetPropertyDaily([FromRoute] Guid propertyId, [FromQuery] string month)
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
                return BadRequest("month must be in format YYYY-MM.");

            var start = new DateTime(monthStart.Year, monthStart.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);

            var unitIds = await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .Select(u => u.Id)
                .ToListAsync();

            if (unitIds.Count == 0)
                return NotFound("No units found for this property.");

            var daily = await _db.MeterReadings
                .Where(r => unitIds.Contains(r.UnitId) && r.Timestamp >= start && r.Timestamp < end)
                .GroupBy(r => r.Timestamp.Date)
                .Select(g => new
                {
                    day = g.Key,
                    usageKwh = g.Select(x => (double)x.UsageKwh).Sum()
                })
                .OrderBy(x => x.day)
                .ToListAsync();

            return Ok(new { propertyId, month, start, end, daily });
        }


        // GET /api/Dashboard/property/{propertyId}?month=YYYY-MM
        [HttpGet("property/{propertyId:guid}")]
        public async Task<ActionResult<object>> GetPropertyDashboard([FromRoute] Guid propertyId, [FromQuery] string month)
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

            var start = new DateTime(monthStart.Year, monthStart.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);

            var units = await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.UnitNumber)
                .ToListAsync();

            if (units.Count == 0)
                return NotFound("No units found for this property.");

            var unitIds = units.Select(u => u.Id).ToList();

            // Latest invoice per unit for this month
            var invoices = await _db.Invoices
                .Where(i => i.BillingMonth == month && unitIds.Contains(i.UnitId))
                .OrderByDescending(i => i.GeneratedAt)
                .ToListAsync();

            // Usage totals per unit
            var usageByUnit = await _db.MeterReadings
                .Where(r => unitIds.Contains(r.UnitId) && r.Timestamp >= start && r.Timestamp < end)
                .GroupBy(r => r.UnitId)
                .Select(g => new
                {
                    UnitId = g.Key,
                    Usage = g.Select(x => (double)x.UsageKwh).Sum()
                })
                .ToListAsync();

            var propertyTotalUsage = usageByUnit.Sum(x => x.Usage);

            var perUnit = units.Select(u =>
            {
                var usage = usageByUnit.FirstOrDefault(x => x.UnitId == u.Id)?.Usage ?? 0.0;
                var invoice = invoices.FirstOrDefault(i => i.UnitId == u.Id);

                return new
                {
                    unitId = u.Id,
                    unitNumber = u.UnitNumber,
                    tenantName = u.TenantName,
                    ratePlanId = u.RatePlanId,
                    totalUsageKwh = Math.Round(usage, 2),
                    invoiceTotalAmount = invoice != null ? invoice.TotalAmount : (decimal?)null,
                    invoiceStatus = invoice != null ? invoice.Status : null
                };
            })
            .OrderByDescending(x => x.totalUsageKwh)
            .ToList();

            var topConsumer = perUnit.FirstOrDefault();

            // Spike detection: per unit per day totals
            var dailyTotals = await _db.MeterReadings
                .Where(r => unitIds.Contains(r.UnitId) && r.Timestamp >= start && r.Timestamp < end)
                .GroupBy(r => new { r.UnitId, Day = r.Timestamp.Date })
                .Select(g => new
                {
                    g.Key.UnitId,
                    DayUsage = g.Select(x => (double)x.UsageKwh).Sum()
                })
                .ToListAsync();

            var perUnitDailyStats = dailyTotals
                .GroupBy(x => x.UnitId)
                .Select(g => new
                {
                    UnitId = g.Key,
                    DaysCount = g.Count(),
                    AvgDaily = g.Average(x => x.DayUsage),
                    MaxDaily = g.Max(x => x.DayUsage)
                })
                .ToList();

            var spikeFlags = perUnitDailyStats
                .Where(x => x.DaysCount >= 2 && x.AvgDaily > 0)
                .Select(x =>
                {
                    var thresholdMult = x.AvgDaily * 1.2;
                    var thresholdAbs = x.AvgDaily + 10.0;
                    var threshold = Math.Min(thresholdMult, thresholdAbs);

                    var isSpike = x.MaxDaily >= thresholdMult || x.MaxDaily >= thresholdAbs;

                    return new
                    {
                        x.UnitId,
                        x.DaysCount,
                        x.AvgDaily,
                        x.MaxDaily,
                        Threshold = threshold,
                        IsSpike = isSpike
                    };
                })
                .Where(x => x.IsSpike)
                .Select(x => new
                {
                    unitId = x.UnitId,
                    daysCount = x.DaysCount,
                    avgDailyKwh = Math.Round(x.AvgDaily, 2),
                    maxDailyKwh = Math.Round(x.MaxDaily, 2),
                    threshold = Math.Round(x.Threshold, 2)
                })
                .ToList();

            var daysInWindow = (end - start).TotalDays;
            var propertyDailyAvg = daysInWindow > 0 ? (propertyTotalUsage / daysInWindow) : 0.0;

            // New invoice totals
            var invoiceAmounts = perUnit
                .Where(x => x.invoiceTotalAmount.HasValue)
                .Select(x => x.invoiceTotalAmount!.Value)
                .ToList();

            var propertyTotalInvoiceAmount = invoiceAmounts.Sum();
            var propertyAvgInvoiceAmount = invoiceAmounts.Count > 0
                ? invoiceAmounts.Average()
                : 0m;

            return Ok(new
            {
                propertyId,
                month,
                start,
                end,
                propertyTotalUsageKwh = Math.Round(propertyTotalUsage, 2),
                propertyDailyAvgKwh = Math.Round(propertyDailyAvg, 2),

                // New values
                propertyTotalInvoiceAmount = Math.Round(propertyTotalInvoiceAmount, 2),
                propertyAvgInvoiceAmount = Math.Round(propertyAvgInvoiceAmount, 2),

                topConsumer,
                units = perUnit,
                spikeAlerts = spikeFlags
            });
        }
    }
}
