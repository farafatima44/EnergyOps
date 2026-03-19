using EnergyOps.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EnergyOps.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Property> Properties => Set<Property>();

        public DbSet<Unit> Units => Set<Unit>();
        
        public DbSet<MeterReading> MeterReadings => Set<MeterReading>();
        
        public DbSet<RatePlan> RatePlans => Set<RatePlan>();
         
        public DbSet<Invoice> Invoices => Set<Invoice>();


    }
}
