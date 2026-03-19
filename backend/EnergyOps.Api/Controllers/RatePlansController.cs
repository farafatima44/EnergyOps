using EnergyOps.Api.Data;
using EnergyOps.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnergyOps.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RatePlansController : ControllerBase
    {
        private readonly AppDbContext _db;

        public RatePlansController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<List<RatePlan>> GetAll()
        {
            return await _db.RatePlans.ToListAsync();
        }

        public class CreateRatePlanRequest
        {
            public string Name { get; set; }
            public decimal RatePerKwh { get; set; }
            public decimal FixedFee { get; set; }
        }

        [HttpPost]
        public async Task<ActionResult<RatePlan>> Create(CreateRatePlanRequest req)
        {
            var plan = new RatePlan
            {
                Name = req.Name,
                RatePerKwh = req.RatePerKwh,
                FixedFee = req.FixedFee
            };

            _db.RatePlans.Add(plan);
            await _db.SaveChangesAsync();

            return Ok(plan);
        }
    }
}
