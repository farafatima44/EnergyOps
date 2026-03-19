# ⚡ EnergyOps Dashboard

Smart Submeter Billing + Monitoring Platform

------------------------------------------------------------------------

## 📌 Project Overview

EnergyOps is a full‑stack energy monitoring and billing system designed
to simulate, monitor, and calculate electricity usage for multi‑unit
properties.

The system allows property managers to:

-   Create properties and units
-   Assign rate plans
-   Simulate smart‑meter readings
-   Generate monthly invoices
-   Detect usage spikes
-   Visualize analytics via interactive dashboard charts

This project demonstrates backend architecture, data modeling, business
logic implementation, and frontend dashboard design.

------------------------------------------------------------------------

## 🏗 Architecture

Frontend: React (Vite)\
Backend: ASP.NET Core Web API\
Database: SQLite (Entity Framework Core)

Architecture Style: - RESTful API - Layered architecture (Controller →
Service/Logic → Data Layer) - Relational database model - Dynamic
simulation-based data generation

------------------------------------------------------------------------

## 🔄 System Flow

1.  Create Property\
2.  Add Units under property\
3.  Create Rate Plan\
4.  Assign Rate Plan to Units\
5.  Simulate Meter Readings\
6.  Generate Monthly Billing\
7.  View Dashboard Analytics

------------------------------------------------------------------------

## 📊 Core Features

### 1. Meter Reading Simulation

-   Generates 4 readings per day per unit
-   Randomized baseline usage
-   Optional spike injection for anomaly detection demo
-   Supports up to 60 days simulation window

### 2. Monthly Billing Engine

Invoice calculation formula:

Total = (TotalUsage × RatePerKwh) + FixedFee

Snapshots rate at generation time to prevent historical inconsistency.

### 3. Spike Detection

A spike is flagged when:

MaxDailyUsage \> (AverageDailyUsage × Threshold)

Used for anomaly detection demo.

### 4. Interactive Dashboard

-   Total Usage KPI
-   Daily Average KPI
-   Invoice Aggregations
-   Top Consumer Identification
-   Line Charts & Bar Charts
-   Click-to-view Invoice Details

------------------------------------------------------------------------

## 🗄 Database Entities

### Property

-   Id (GUID)
-   Name
-   Address
-   CreatedAt

### Unit

-   Id (GUID)
-   PropertyId (FK)
-   UnitNumber
-   TenantName
-   RatePlanId

### RatePlan

-   Id (GUID)
-   Name
-   RatePerKwh
-   FixedFee

### MeterReading

-   Id
-   UnitId
-   Timestamp
-   UsageKwh
-   Source

### Invoice

-   Id
-   UnitId
-   BillingMonth
-   TotalUsageKwh
-   RatePerKwhSnapshot
-   FixedFeeSnapshot
-   TotalAmount
-   Status

------------------------------------------------------------------------

## 🧮 Example Calculation

If: - Usage = 398.93 kWh - Rate = \$0.18 - Fixed Fee = \$12

Then:

398.93 × 0.18 = 71.81\
71.81 + 12 = **83.81 USD**

------------------------------------------------------------------------

## 🚀 How To Run

### Backend

``` bash
cd backend/EnergyOps.Api
dotnet run
```

Swagger available at: https://localhost:7079/swagger

### Frontend

``` bash
cd frontend
npm install
npm run dev
```

Dashboard available at: http://localhost:5173

------------------------------------------------------------------------

## 🎯 Interview Talking Points

-   Demonstrates REST API design
-   Entity Framework relational modeling
-   Business logic separation
-   Data simulation techniques
-   Snapshot billing consistency
-   Anomaly detection logic
-   Full‑stack integration
-   Real‑time dynamic dashboard
-   Clean UI with interactive charts

------------------------------------------------------------------------

## 📈 Future Enhancements

-   Role-based authentication
-   Cloud deployment (Azure / AWS)
-   Real smart-meter API integration
-   Historical trend analytics
-   PDF invoice generation
-   Export to CSV
-   Alert notifications

------------------------------------------------------------------------

## 👨‍💻 Author

EnergyOps Project\
Full‑Stack Energy Monitoring & Billing Demo

------------------------------------------------------------------------

© 2026 EnergyOps Demo Project
