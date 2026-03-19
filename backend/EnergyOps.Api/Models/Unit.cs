using System;

namespace EnergyOps.Api.Models
{
    public class Unit
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid PropertyId { get; set; }

        public string UnitNumber { get; set; }

        public string TenantName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid? RatePlanId { get; set; }

  


    }
}
