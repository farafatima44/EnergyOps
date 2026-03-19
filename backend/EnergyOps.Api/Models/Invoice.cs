using System;

namespace EnergyOps.Api.Models
{
    public class Invoice
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UnitId { get; set; }
        public string BillingMonth { get; set; }  // "YYYY-MM"
        public decimal TotalUsageKwh { get; set; }
        public decimal RatePerKwhSnapshot { get; set; }
        public decimal FixedFeeSnapshot { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = "Draft";
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    }
}
