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

var offers = new[]
{
    new Offer("Happy Hour",      "Any coffee, 4 PM to 6 PM. Bring a friend, both get the deal.", 20),
    new Offer("Breakfast Combo", "Filter coffee with a paneer puff before 11 AM.",               15),
    new Offer("Sweet Finish",    "Add any dessert to a sandwich order.",                         10)
};

app.MapGet("/offers", () => Results.Ok(new { pod, offers }));
app.MapGet("/healthz", () => Results.Ok("ok"));

app.Run();

record Offer(string Title, string Description, int DiscountPercent);
