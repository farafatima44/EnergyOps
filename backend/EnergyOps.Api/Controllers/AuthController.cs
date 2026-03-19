using Microsoft.AspNetCore.Mvc;

namespace EnergyOps.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        public class LoginRequest
        {
            public string? Username { get; set; }
            public string? Password { get; set; }
        }

        [HttpPost("login")]
        public ActionResult<object> Login([FromBody] LoginRequest? req)
        {
            if (req == null)
                return BadRequest("Invalid body.");

            var user = req.Username?.Trim().ToLower();
            var pass = req.Password?.Trim();

            if (user == "admin" && pass == "admin123")
            {
                return Ok(new
                {
                    ok = true,
                    role = "Admin"
                });
            }

            if (user == "manager" && pass == "manager123")
            {
                return Ok(new
                {
                    ok = true,
                    role = "PropertyManager"
                });
            }

            return Unauthorized("Invalid credentials.");
        }
    }
}
