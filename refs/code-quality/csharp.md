# Modern C# Code Structure Quality Guide

Domain-agnostic rules for LLM-generated C# code. Targets C# 12 / .NET 8+.

---

## MVVM Boundaries

View = pure presentation. ViewModel = state + commands. Model = domain logic.
ViewModel must never reference `System.Windows` types.

```csharp
// Bad — ViewModel coupled to View
public class OrderVM { private readonly OrderWindow _w; public void Save() { _w.Close(); } }

// Good — ViewModel exposes intent, View reacts
public partial class OrderVM : ObservableObject
{
    public event Action? CloseRequested;
    [RelayCommand]
    private void Save() { _repo.Save(_order); CloseRequested?.Invoke(); }
}
```

## Dependency Injection

Constructor injection only. No `new` inside classes. No Service Locator outside composition root.

```csharp
// Bad
public class CustomerVM { private readonly CustomerService _svc = new(); }
// Good — C# 12 primary constructor
public class CustomerVM(ICustomerService svc) : ObservableObject
{
    [RelayCommand] private async Task LoadAsync() => Customers = await svc.GetAllAsync();
}
```

## INotifyPropertyChanged & Commands

Use CommunityToolkit.Mvvm `[ObservableProperty]` and `[RelayCommand]`. Always implement `CanExecute`.

```csharp
// Bad — manual boilerplate, always-enabled command
private string _name = "";
public string Name { get => _name; set { _name = value; OnPropertyChanged(); } }
public ICommand SaveCmd => new RelayCommand(() => Save());

// Good — source-generated, guarded command
[ObservableProperty] [NotifyPropertyChangedFor(nameof(FullName))]
private string _name = "";

[RelayCommand(CanExecute = nameof(CanSave))]
private async Task SaveAsync() => await _repo.SaveAsync(_order);
private bool CanSave => _order is { IsValid: true } && !IsBusy;
```

## Async / Await

`async void` only for event handlers. Never `.Result`/`.Wait()`. `ConfigureAwait(false)` in libraries.

```csharp
// Bad — deadlock
public void Load() { var data = _svc.GetDataAsync().Result; }
// Good
public async Task LoadAsync()
{
    var data = await _svc.GetDataAsync();
    Items = new ObservableCollection<Item>(data);
}
```

## Collections & Interfaces

`ObservableCollection<T>` for bound lists — replace entire collection for bulk updates.
Every external dependency behind an interface: `IRepository<T>`, `IFileService`,
`IDialogService`, `INavigationService`, `TimeProvider` (.NET 8 built-in).

```csharp
// Bad — fires N events
foreach (var item in items) Collection.Add(item);
// Good — single notification
Items = new ObservableCollection<Item>(await _svc.GetAllAsync());
```

---

## Modern C# 12 / .NET 8

### Records & primary constructors

```csharp
// Bad — equality boilerplate class
public class Money { public decimal Amount { get; } public string Currency { get; }
    public override bool Equals(object? obj) => /* 5 more lines */ }
// Good — record
public record Money(decimal Amount, string Currency);

// Bad — field + constructor ceremony
public class OrderService { private readonly IOrderRepository _r;
    public OrderService(IOrderRepository r) { _r = r; } }
// Good — primary constructor
public class OrderService(IOrderRepository repo, ILogger<OrderService> logger) : IOrderService
{
    public async Task<Order?> GetAsync(int id) => await repo.FindAsync(id);
}
```

### Pattern matching & switch expressions

```csharp
// Bad — nested if/else
if (shape is Circle c) return Math.PI * c.Radius * c.Radius;
else if (shape is Rectangle r) return r.Width * r.Height;
// Good — exhaustive switch expression
double area = shape switch
{
    Circle c => Math.PI * c.Radius * c.Radius, Rectangle r => r.Width * r.Height,
    _ => throw new ArgumentOutOfRangeException(nameof(shape))
};
```

### Collection expressions, raw strings, required members

```csharp
// Bad
List<int> ids = new List<int> { 1, 2, 3 };
string json = "{\n  \"name\": \"test\"\n}";
// Good
List<int> ids = [1, 2, 3];
string json = """{ "name": "test" }""";
public class Config
{
    public required string ConnectionString { get; init; }
    public required int MaxRetries { get; init; }
}
```

---

## Clean Architecture Layers

### Domain — entities, value objects, domain events (zero dependencies)

```csharp
// Bad — anemic entity
public class Order { public string Status { get; set; } = ""; }
// Good — rich domain
public class Order : Entity
{
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public void Confirm()
    {
        if (Status != OrderStatus.Draft) throw new DomainException("Only draft orders");
        Status = OrderStatus.Confirmed;
        AddDomainEvent(new OrderConfirmedEvent(Id));
    }
}
```

### Application — use cases via MediatR handlers

```csharp
// Bad — logic in controller
app.MapPost("/orders/{id}/confirm", async (int id, AppDbContext db) =>
    { var o = await db.Orders.FindAsync(id); o!.Status = "Confirmed"; await db.SaveChangesAsync(); });
// Good — handler encapsulates use case
public record ConfirmOrderCommand(int OrderId) : IRequest<ErrorOr<OrderDto>>;
public class ConfirmOrderHandler(IOrderRepository repo, IUnitOfWork uow)
    : IRequestHandler<ConfirmOrderCommand, ErrorOr<OrderDto>>
{
    public async Task<ErrorOr<OrderDto>> Handle(ConfirmOrderCommand cmd, CancellationToken ct)
    {
        var order = await repo.GetByIdAsync(cmd.OrderId, ct);
        if (order is null) return Error.NotFound("Order.NotFound");
        order.Confirm();
        await uow.SaveChangesAsync(ct);
        return order.ToDto();
    }
}
```

### Infrastructure & DependencyInjection.cs per layer

```csharp
// Bad — DbContext in application layer
public class OrderHandler { private readonly AppDbContext _db; }
// Good — repository in infra, wired via DI extension
public class OrderRepository(AppDbContext db) : IOrderRepository
{
    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct)
        => await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id, ct);
}
// Each layer exposes: services.AddDomain() / AddApplication() / AddInfrastructure(config)
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection svc, IConfiguration cfg)
    {
        svc.AddDbContext<AppDbContext>(o => o.UseNpgsql(cfg.GetConnectionString("Default")));
        svc.AddScoped<IOrderRepository, OrderRepository>();
        return svc;
    }
}
```

---

## Error Handling

### Result / ErrorOr pattern — no exceptions for control flow

```csharp
// Bad — throwing for expected cases
public Order GetOrder(int id) =>
    _db.Orders.Find(id) ?? throw new NotFoundException($"Order {id}");
// Good — errors as values
public async Task<ErrorOr<OrderDto>> GetOrderAsync(int id)
{
    var order = await _repo.GetByIdAsync(id);
    return order is null ? Error.NotFound("Order.NotFound") : order.ToDto();
}
```

### FluentValidation + MediatR pipeline

```csharp
// Bad — manual validation in handler
if (string.IsNullOrEmpty(cmd.Name)) return Error.Validation("Name required");
// Good — declarative validation via pipeline behavior
public class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Public member | PascalCase | `OrderStatus`, `GetByIdAsync` |
| Private field | _camelCase | `_orderRepository` |
| Interface | I prefix | `IOrderService` |
| Async method | Async suffix | `SaveAsync`, `LoadDataAsync` |
| Suffixes | -Service, -Repository, -Handler, -Factory, -Validator | `OrderService` |

```csharp
// Bad
public class orderSvc { private IOrderRepository repo; public void save() { } }
// Good
public class OrderService(IOrderRepository _orderRepository) : IOrderService
{
    public async Task SaveAsync(Order order) => await _orderRepository.UpdateAsync(order);
}
```

---

## Reference Repos

| Repository | Stars | Key Pattern |
|-----------|-------|-------------|
| `jasontaylordev/CleanArchitecture` | 20k | 4-layer template, MediatR, FluentValidation |
| `ardalis/CleanArchitecture` | 18k | Specification pattern, domain events |
| `dotnet/eShop` | 10k | Production DDD, microservices, .NET 8 |
| `amantinband/clean-architecture` | 1.9k | ErrorOr pattern, functional error handling |
| `CommunityToolkit/MVVM-Samples` | 1.4k | ObservableProperty, RelayCommand, Messenger |
