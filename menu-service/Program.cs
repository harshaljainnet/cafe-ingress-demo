var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// In Kubernetes, POD_NAME is injected from the pod's own metadata (see k8s/deployment.yaml).
// Outside Kubernetes (plain "dotnet run") we fall back to the machine name.
var pod = Environment.GetEnvironmentVariable("POD_NAME") ?? Environment.MachineName;

// Never let the browser cache API responses, so every click really reaches a pod.
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next();
});

var items = new[]
{
    new MenuItem("Cappuccino",        180.0, "Coffee",   "Double espresso with silky steamed milk and a thick foam cap."),
    new MenuItem("Cold Coffee",       200.0, "Coffee",   "Chilled and creamy, blended with vanilla ice cream."),
    new MenuItem("Filter Coffee",     120.0, "Coffee",   "South Indian style decoction, strong and frothy."),
    new MenuItem("Veg Club Sandwich", 220.0, "Snacks",   "Triple-layer toast with cucumber, tomato, cheese and mint chutney."),
    new MenuItem("Paneer Puff",       90.0,  "Snacks",   "Flaky pastry stuffed with spiced paneer, baked fresh every morning."),
    new MenuItem("Peri Peri Fries",   150.0, "Snacks",   "Crispy fries tossed in peri peri seasoning with a garlic dip."),
    new MenuItem("Chocolate Brownie", 160.0, "Desserts", "Warm, fudgy brownie served with a drizzle of dark chocolate."),
    new MenuItem("Blueberry Cheesecake", 250.0, "Desserts", "Baked New York style cheesecake with blueberry compote."),
    new MenuItem("Gulab Jamun",       110.0, "Desserts", "Two soft jamuns in cardamom syrup, served warm.")
};

app.MapGet("/menu", () => Results.Ok(new { pod, items }));
app.MapGet("/healthz", () => Results.Ok("ok"));

app.Run();

record MenuItem(string Name, double Price, string Category, string Description);
