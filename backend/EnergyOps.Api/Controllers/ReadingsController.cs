using System;
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
    public class ReadingsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ReadingsController(AppDbContext db)
        {
            _db = db;
        }

        // POST /api/Readings/simulate?propertyId=...&days=7&spike=true
        [HttpPost("simulate")]
        public async Task<ActionResult<object>> Simulate(
            [FromQuery] Guid propertyId,
            [FromQuery] int days = 7,
            [FromQuery] bool spike = false)
        {
            if (propertyId == Guid.Empty)
                return BadRequest("propertyId is required.");

            if (days <= 0 || days > 60)
                return BadRequest("days must be between 1 and 60.");

            var units = await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.CreatedAt)
                .ToListAsync();

            if (units.Count == 0)
                return NotFound("No units found for this property.");

            var utcNow = DateTime.UtcNow;

            // window: last N days, aligned to UTC midnight
            var start = new DateTime(utcNow.Year, utcNow.Month, utcNow.Day, 0, 0, 0, DateTimeKind.Utc)
                .AddDays(-days);

            var end = start.AddDays(days);

            var unitIds = units.Select(u => u.Id).ToList();

            // FIX A: clear existing readings in this same window so simulation is repeatable
            var existingReadings = await _db.MeterReadings
                .Where(r => unitIds.Contains(r.UnitId) && r.Timestamp >= start && r.Timestamp < end)
                .ToListAsync();

            _db.MeterReadings.RemoveRange(existingReadings);

            var rng = new Random();
            var inserted = 0;

            // Pick a unit to spike (first unit is fine for demo)
            var spikeUnitId = units.First().Id;

            for (int d = 0; d < days; d++)
            {
                var day = start.AddDays(d);

                foreach (var unit in units)
                {
                    // 4 readings per day (every 6 hours)
                    for (int h = 0; h < 24; h += 6)
                    {
                        var ts = day.AddHours(h);

                        var baseUsage = Math.Round(0.8 + rng.NextDouble() * 1.8, 2);

                        if (spike && unit.Id == spikeUnitId && d == days - 1)
                        {
                            baseUsage = Math.Round(baseUsage * 8.0, 2);
                        }

                        _db.MeterReadings.Add(new MeterReading
                        {
                            UnitId = unit.Id,
                            Timestamp = ts,
                            UsageKwh = (decimal)baseUsage,
                            Source = spike && unit.Id == spikeUnitId && d == days - 1
                                ? "SimulatedSpike"
                                : "Simulated"
                        });

                        inserted++;
                    }
                }
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                propertyId,
                days,
                units = units.Count,
                deletedExisting = existingReadings.Count,
                inserted,
                spikeApplied = spike,
                spikeUnitId,
                start,
                end
            });
        }

    }
}
