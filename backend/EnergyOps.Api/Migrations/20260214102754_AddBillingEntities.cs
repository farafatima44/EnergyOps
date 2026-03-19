using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnergyOps.Api.Migrations
{
    public partial class AddBillingEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RatePlanId",
                table: "Units",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BillingMonth = table.Column<string>(type: "TEXT", nullable: false),
                    TotalUsageKwh = table.Column<decimal>(type: "TEXT", nullable: false),
                    RatePerKwhSnapshot = table.Column<decimal>(type: "TEXT", nullable: false),
                    FixedFeeSnapshot = table.Column<decimal>(type: "TEXT", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RatePlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    RatePerKwh = table.Column<decimal>(type: "TEXT", nullable: false),
                    FixedFee = table.Column<decimal>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatePlans", x => x.Id);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Invoices");

            migrationBuilder.DropTable(
                name: "RatePlans");

            migrationBuilder.DropColumn(
                name: "RatePlanId",
                table: "Units");
        }
    }
}
