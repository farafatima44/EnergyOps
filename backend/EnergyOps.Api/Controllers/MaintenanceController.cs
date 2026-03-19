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
    public class MaintenanceController : ControllerBase
    {
        private readonly AppDbContext _db;

        public MaintenanceController(AppDbContext db)
        {
            _db = db;
        }

        // DELETE /api/Maintenance/property/{propertyId}?month=YYYY-MM&includeInvoices=true
        [HttpDelete("property/{propertyId:guid}")]
        public async Task<ActionResult<object>> ResetPropertyMonth(
            Guid propertyId,
            string month,
            bool includeInvoices = true)
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
                return BadRequest("Invalid month format.");
            }

            var start = new DateTime(monthStart.Year, monthStart.Month, 1);
            var end = start.AddMonths(1);

            var unitIds = await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .Select(u => u.Id)
                .ToListAsync();

            var readings = await _db.MeterReadings
                .Where(r => unitIds.Contains(r.UnitId) &&
                            r.Timestamp >= start &&
                            r.Timestamp < end)
                .ToListAsync();

            _db.MeterReadings.RemoveRange(readings);

            int invoicesDeleted = 0;

            if (includeInvoices)
            {
                var invoices = await _db.Invoices
                    .Where(i => unitIds.Contains(i.UnitId) &&
                                i.BillingMonth == month)
                    .ToListAsync();

                _db.Invoices.RemoveRange(invoices);
                invoicesDeleted = invoices.Count;
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                propertyId,
                month,
                readingsDeleted = readings.Count,
                invoicesDeleted
            });
        }
    }
}
