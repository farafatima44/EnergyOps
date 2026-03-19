using System;

namespace EnergyOps.Api.Models
{
    public class MeterReading
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid UnitId { get; set; }

        public DateTime Timestamp { get; set; }

        public decimal UsageKwh { get; set; }

        public string Source { get; set; } = "Manual";
    }
}
