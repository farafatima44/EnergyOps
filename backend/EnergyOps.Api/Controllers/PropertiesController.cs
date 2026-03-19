using EnergyOps.Api.Data;
using EnergyOps.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnergyOps.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PropertiesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public PropertiesController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<Property>>> GetAll()
        {
            return await _db.Properties
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        [HttpGet("{propertyId:guid}")]
        public async Task<ActionResult<Property>> GetById(Guid propertyId)
        {
            var property = await _db.Properties.FindAsync(propertyId);
            if (property == null) return NotFound();

            return property;
        }

        public class CreatePropertyRequest
        {
            public string Name { get; set; }
            public string? Address { get; set; }
        }

        [HttpPost]
        public async Task<ActionResult<Property>> Create(CreatePropertyRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("Name required.");

            var property = new Property
            {
                Name = req.Name.Trim(),
                Address = req.Address?.Trim()
            };

            _db.Properties.Add(property);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById),
                new { propertyId = property.Id },
                property);
        }

        [HttpGet("{propertyId:guid}/units")]
        public async Task<ActionResult<List<Unit>>> GetUnits(Guid propertyId)
        {
            return await _db.Units
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.UnitNumber)
                .ToListAsync();
        }

        public class CreateUnitRequest
        {
            public string UnitNumber { get; set; }
            public string? TenantName { get; set; }
        }

        [HttpPost("{propertyId:guid}/units")]
        public async Task<ActionResult<Unit>> CreateUnit(Guid propertyId, CreateUnitRequest req)
        {
            var unit = new Unit
            {
                PropertyId = propertyId,
                UnitNumber = req.UnitNumber.Trim(),
                TenantName = req.TenantName?.Trim()
            };

            _db.Units.Add(unit);
            await _db.SaveChangesAsync();

            return Ok(unit);
        }

        public class SetUnitRatePlanRequest
        {
            public Guid RatePlanId { get; set; }
        }

        [HttpPut("/api/units/{unitId:guid}/rateplan")]
        public async Task<ActionResult> SetRatePlan(Guid unitId, SetUnitRatePlanRequest req)
        {
            var unit = await _db.Units.FindAsync(unitId);
            if (unit == null) return NotFound();

            unit.RatePlanId = req.RatePlanId;
            await _db.SaveChangesAsync();

            return Ok(new { unitId, req.RatePlanId });
        }

        [HttpDelete("/api/units/{unitId:guid}")]
        public async Task<ActionResult> DeleteUnit(Guid unitId)
        {
            var unit = await _db.Units.FindAsync(unitId);
            if (unit == null) return NotFound();

            var readings = _db.MeterReadings.Where(r => r.UnitId == unitId);
            _db.MeterReadings.RemoveRange(readings);

            var invoices = _db.Invoices.Where(i => i.UnitId == unitId);
            _db.Invoices.RemoveRange(invoices);

            _db.Units.Remove(unit);
            await _db.SaveChangesAsync();

            return Ok();
        }
    }
}
