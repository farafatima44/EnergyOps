using System;

namespace EnergyOps.Api.Models
{
    public class RatePlan
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; }
        public decimal RatePerKwh { get; set; }
        public decimal FixedFee { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
