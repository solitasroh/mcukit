# C# / WPF Structure Rules

These rules apply when generating or reviewing C# code,
with special attention to WPF applications using MVVM.

---

## MVVM Boundaries

The entire point of MVVM is testability. If a ViewModel references
`System.Windows` or a View references business logic, that boundary
is broken and tests become impossible without a UI thread.

- **View** (XAML + code-behind): Pure presentation. Code-behind
  contains only UI mechanics that cannot be expressed in XAML
  (e.g. focus management). No business logic, no service calls.
- **ViewModel**: Exposes state and commands for the View to bind.
  Never references a concrete View type or any `System.Windows` type.
- **Model**: Domain objects and business rules. No UI framework
  dependencies. No `INotifyPropertyChanged` — that belongs in VM.

```csharp
// Bad — ViewModel knows about the View
public class OrderViewModel
{
    private readonly OrderWindow _window; // violation
    public void Save() { _window.Close(); }
}

// Good — ViewModel exposes an event or service
public class OrderViewModel
{
    public event Action? CloseRequested;
    public void Save()
    {
        _repository.Save(_order);
        CloseRequested?.Invoke();
    }
}
```

## Dependency Injection

- Constructor injection is the default. Every dependency a class
  needs to function is declared in its constructor.
- Service Locator is allowed only in composition roots (App.xaml.cs
  or a bootstrapper). Calling the container from inside a ViewModel
  or service is an anti-pattern.
- Register interfaces, resolve interfaces. Concrete types appear
  only in the composition root's registration code.

```csharp
// Bad — ViewModel creates its own dependency
public class CustomerViewModel
{
    private readonly CustomerService _service = new CustomerService();
}

// Good — dependency injected
public class CustomerViewModel
{
    private readonly ICustomerService _service;
    public CustomerViewModel(ICustomerService service) => _service = service;
}
```

## INotifyPropertyChanged

- Use a base class (`ObservableObject`, `BindableBase`, or the
  CommunityToolkit `ObservableObject`) to eliminate repetitive
  `OnPropertyChanged` boilerplate.
- With CommunityToolkit.Mvvm, prefer `[ObservableProperty]` source
  generator over manual property definitions.
- Raise `PropertyChanged` only when the value actually changes.
  Guard with `if (value == field) return;`.

## Commands

- Use `RelayCommand` / `DelegateCommand` / `[RelayCommand]` attribute.
- Always implement `CanExecute`. A command that is always enabled
  is a missing validation.
- `CanExecute` should re-evaluate when relevant state changes.
  Call `NotifyCanExecuteChanged()` or use `ObservesProperty`.

## Async / Await

- `async void` is permitted only on event handlers. Every other
  async method returns `Task` or `Task<T>`.
- Library code (services, repositories) uses
  `ConfigureAwait(false)` to avoid unnecessary UI-thread marshaling.
- Never call `.Result` or `.Wait()` on a Task — it deadlocks
  the UI thread.
- Wrap long-running CPU work in `Task.Run`, but never access
  UI elements from inside `Task.Run`.

```csharp
// Bad — deadlock risk
public void LoadData()
{
    var data = _service.GetDataAsync().Result; // blocks UI thread
}

// Good
public async Task LoadDataAsync()
{
    var data = await _service.GetDataAsync();
    Items = new ObservableCollection<Item>(data);
}
```

## Collections

- `ObservableCollection<T>` for lists bound to UI.
- For bulk updates, consider replacing the entire collection
  rather than adding items one by one (each Add fires an event).
- `ReadOnlyObservableCollection<T>` for exposing to the View
  when mutation should be internal to the ViewModel.

## Interfaces for Testability

Every external dependency — file I/O, network, database, dialogs,
navigation, timers — sits behind an interface. This is the only
way to unit-test ViewModels without spinning up a real database
or a real UI thread.

| Dependency | Interface example |
|-----------|-------------------|
| Database | `IRepository<T>` |
| File system | `IFileService` |
| Dialog | `IDialogService` |
| Navigation | `INavigationService` |
| Clock/Timer | `ITimeProvider` |
