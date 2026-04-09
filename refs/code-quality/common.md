# Code Structure Quality — Universal Guide

> Apply these rules whenever generating code, regardless of language or domain.
> AI-generated code introduces 1.7x more structural issues (CodeRabbit 2026)
> and 4x more duplication (GitClear 2025). These rules prevent that.

---

## 1. Clean Architecture — Layer Placement Guide

Dependencies always point inward. Never import outward.

```
[Presentation / UI / API]      ← Depends on Application
         ↓
[Application / Use Cases]      ← Depends on Domain
         ↓
[Domain / Business Logic]      ← Depends on nothing (pure)
         ↑
[Infrastructure / Data Access] ← Depends on Domain (implements interfaces)
```

### Where does this code belong?

| Code Type | Layer | Why |
|-----------|-------|-----|
| UI rendering, input handling, controllers | Presentation | User interaction boundary |
| Use case orchestration, "do X then Y" | Application | Business flow coordination |
| Core business rules, entities, value objects | Domain | Framework-independent truth |
| DB queries, HTTP clients, file I/O | Infrastructure | External world adapters |
| DTOs, request/response shapes | Presentation or Application | Transfer objects at boundaries |
| Interfaces/ports for external services | Domain | Abstractions owned by inner layer |

### Bad/Good: Layer Violation

```
// BAD — Domain depends on Infrastructure (outward dependency)
class Order {
  save() {
    const db = new PostgresDatabase();  // Domain knows about DB
    db.insert(this);
  }
}

// GOOD — Domain defines interface, Infrastructure implements
// Domain layer:
interface OrderRepository {
  save(order: Order): void;
}

// Infrastructure layer:
class PostgresOrderRepository implements OrderRepository {
  save(order: Order) { /* DB logic here */ }
}

// Application layer:
class CreateOrderUseCase {
  constructor(private repo: OrderRepository) {}  // injected
  execute(data: OrderData) {
    const order = Order.create(data);
    this.repo.save(order);
  }
}
```

---

## 2. Architecture Selection Guide

### When to use which architecture?

| Project Characteristic | Architecture | Why |
|----------------------|--------------|-----|
| Small app, <10 use cases | **Simple layered** | Over-engineering kills velocity |
| Medium app, clear domain rules | **Clean Architecture** | Business logic isolated from frameworks |
| Many independent features, rapid delivery | **Vertical Slice** | Feature = folder, zero cross-feature coupling |
| Large app with future microservice split | **Modular Monolith** | Module boundaries = future service boundaries |
| Heavy external integrations (APIs, DBs, queues) | **Hexagonal (Ports & Adapters)** | Swap adapters without touching core |
| Mix of complex + simple features | **Hybrid** | Complex features → Clean, simple CRUD → Vertical Slice |

### Clean Architecture — Practical Directory Structure

```
src/
├── Domain/                    # Pure business logic, ZERO dependencies
│   ├── Entities/              # Order, User, Product (rich, not anemic)
│   ├── ValueObjects/          # Money, Email, Address (immutable, self-validating)
│   ├── Events/                # OrderConfirmedEvent (domain events)
│   ├── Interfaces/            # IOrderRepository, IEmailSender (ports)
│   └── Exceptions/            # DomainException, BusinessRuleViolation
│
├── Application/               # Use cases, orchestration
│   ├── Orders/                # Feature-grouped
│   │   ├── Commands/          # CreateOrderCommand + Handler
│   │   ├── Queries/           # GetOrderQuery + Handler
│   │   └── DTOs/              # OrderDto, CreateOrderRequest
│   ├── Common/
│   │   ├── Behaviors/         # ValidationBehavior, LoggingBehavior (pipeline)
│   │   └── Interfaces/        # IUnitOfWork, ICurrentUser
│   └── DependencyInjection.cs
│
├── Infrastructure/            # External world adapters
│   ├── Persistence/           # EF DbContext, Repositories
│   ├── ExternalServices/      # EmailSender, PaymentGateway
│   ├── Identity/              # Auth provider implementation
│   └── DependencyInjection.cs
│
└── Presentation/              # Entry point (API, UI)
    ├── Controllers/           # or Endpoints/ (minimal API)
    ├── Middleware/             # Exception handling, auth
    └── Program.cs             # Composition root
```

### Vertical Slice — Feature-First Directory

```
src/
├── Features/
│   ├── Orders/
│   │   ├── CreateOrder.cs     # Request + Handler + Validator + Response — ALL IN ONE
│   │   ├── GetOrder.cs
│   │   ├── CancelOrder.cs
│   │   └── OrderEntity.cs     # Entity lives with its feature
│   ├── Users/
│   │   ├── RegisterUser.cs
│   │   └── GetUserProfile.cs
│   └── Shared/                # Cross-feature abstractions only
│       ├── IRepository.cs
│       └── Result.cs
└── Program.cs
```

### Hexagonal (Ports & Adapters) — Core + Ports + Adapters

```
src/
├── Core/                      # Business logic
│   ├── Domain/                # Entities, Value Objects
│   └── Ports/                 # Interfaces (what the core NEEDS)
│       ├── Inbound/           # ICreateOrderUseCase (driven by)
│       └── Outbound/          # IOrderRepository, IEmailPort (drives)
│
├── Adapters/
│   ├── Inbound/               # REST controller, CLI, gRPC (drives the core)
│   │   └── OrderController.cs
│   └── Outbound/              # DB, Email, Queue (driven by the core)
│       ├── PostgresOrderRepo.cs
│       └── SmtpEmailAdapter.cs
│
└── Config/                    # Wiring adapters to ports
    └── DependencyInjection.cs
```

### How layers communicate — Data Flow

```
Request (HTTP/CLI/Event)
    ↓
[Presentation] — validates input, maps to command/query DTO
    ↓
[Application] — orchestrates use case, calls domain + infrastructure via interfaces
    ↓
[Domain] — enforces business rules, raises domain events
    ↑
[Infrastructure] — implements interfaces defined by domain (repository, email, etc.)
    ↓
Response (DTO → JSON/View)

KEY RULES:
- Data crosses boundaries via DTOs or primitive types, never domain entities
- Domain NEVER imports from Application/Infrastructure/Presentation
- Infrastructure implements Domain interfaces (Dependency Inversion)
- Application coordinates, Domain decides, Infrastructure executes
```

### Adding a new feature — Decision Checklist

When asked to add a new feature, follow this checklist:

1. **Does it change business rules?** → Domain layer (entity method, value object)
2. **Does it orchestrate multiple steps?** → Application layer (use case / handler)
3. **Does it need external I/O?** → Infrastructure layer (implement domain interface)
4. **Does it need a new UI/API endpoint?** → Presentation layer
5. **Does it need a new interface?** → Define in Domain, implement in Infrastructure
6. **Is it cross-cutting (logging, validation, auth)?** → Pipeline behavior / middleware
7. **Is it a new independent feature?** → Consider vertical slice (own folder)

---

## 3. OOP Principles — Practical Application

### 2.1 Composition Over Inheritance

Use inheritance only for genuine "is-a" relationships. Default to composition.

```
// BAD — Inheritance for code reuse (not is-a)
class EmailService extends Logger {
  send(email) { this.log("sending..."); /* send logic */ }
}

// GOOD — Composition
class EmailService {
  constructor(private logger: Logger) {}
  send(email) { this.logger.log("sending..."); /* send logic */ }
}
```

### 2.2 Interface Segregation

Many small interfaces > one fat interface.

```
// BAD — God interface
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  report(): void;
}

// GOOD — Segregated
interface Workable { work(): void; }
interface Feedable { eat(): void; }
interface Reportable { report(): void; }

class Robot implements Workable, Reportable {
  work() { /* ... */ }
  report() { /* ... */ }
  // No need to implement eat() or sleep()
}
```

### 2.3 Dependency Inversion

High-level modules depend on abstractions, not concrete implementations.

```
// BAD — High-level depends on low-level
class NotificationService {
  private mailer = new GmailSender();     // hard-wired
  private sms = new TwilioSender();       // hard-wired
}

// GOOD — Depend on abstraction, inject concrete
interface MessageSender {
  send(to: string, body: string): void;
}

class NotificationService {
  constructor(private senders: MessageSender[]) {}  // injected
}
```

---

## 4. Design Pattern Selection

Use a pattern when it eliminates a structural problem. Do NOT use one when a simple conditional suffices.

| Signal in Your Code | Pattern | Apply When |
|---------------------|---------|------------|
| 3+ branches on same axis (if/elif chain) | **Strategy** | Algorithm varies at runtime |
| Object type varies by input string/enum | **Factory Method** | Creator shouldn't know concrete types |
| Behavior changes with internal state | **State** | Replace state-checking if/else chains |
| One change must notify many listeners | **Observer** | Decouple publisher from subscribers |
| Constructor has 4+ params or optional combos | **Builder** | Complex object assembly |
| Need to wrap existing interface | **Adapter** | Integrate without modifying third-party |
| Add responsibility without subclassing | **Decorator** | Layer behaviors at runtime |
| 2 or fewer branches, unlikely to grow | **Keep the if** | Premature pattern adds complexity |

### Strategy Pattern — Multi-Language Skeleton

```
// Concept: extract varying algorithm into swappable objects

// C++
class Compressor {
public:
  virtual ~Compressor() = default;
  virtual std::vector<uint8_t> compress(std::span<const uint8_t> data) = 0;
};
class GzipCompressor : public Compressor { /* ... */ };
class LZ4Compressor : public Compressor { /* ... */ };

// C#
interface ICompressor {
  byte[] Compress(ReadOnlySpan<byte> data);
}
class GzipCompressor : ICompressor { /* ... */ }

// TypeScript
interface Compressor {
  compress(data: Uint8Array): Uint8Array;
}
const gzipCompressor: Compressor = { compress: (data) => /* ... */ };

// Python
class Compressor(Protocol):
    def compress(self, data: bytes) -> bytes: ...
class GzipCompressor:
    def compress(self, data: bytes) -> bytes: ...
```

---

## 5. Code Smells & Anti-Patterns

| Smell | Symptom | Fix |
|-------|---------|-----|
| **God Object** | Class with 10+ public methods, 500+ lines | Split by responsibility |
| **Feature Envy** | Method uses another class's data more than its own | Move method to that class |
| **Primitive Obsession** | Email as `string`, Money as `float` | Create value objects |
| **Shotgun Surgery** | One change requires editing 5+ files | Extract shared abstraction |
| **Long Parameter List** | Function with 4+ parameters | Introduce parameter object |
| **Deep Nesting** | 4+ levels of if/for/while | Early return, extract helpers |
| **Duplicate Code** | Same 3+ lines in 2+ places | Extract to shared function |
| **Dead Code** | Commented-out code, unreachable branches | Delete it entirely |

### Bad/Good: Primitive Obsession

```
// BAD — Money as float, email as string
function createOrder(price: number, currency: string, email: string) {
  if (price < 0) throw new Error("negative");
  if (!email.includes("@")) throw new Error("invalid");
  // Validation scattered everywhere this data is used
}

// GOOD — Value objects encapsulate validation
class Money {
  constructor(readonly amount: number, readonly currency: string) {
    if (amount < 0) throw new Error("negative");
  }
}
class Email {
  constructor(readonly value: string) {
    if (!value.includes("@")) throw new Error("invalid");
  }
}
function createOrder(price: Money, email: Email) {
  // Already validated by construction
}
```

---

## 6. Sizing Limits (Enforced by PostToolUse Hook)

| Metric | Limit | Action When Exceeded |
|--------|-------|---------------------|
| Function body | 40 lines | Extract semantic helper functions |
| Function parameters | 3 | Introduce parameter object or Builder |
| Nesting depth | 3 levels | Early return, guard clauses, extract |
| Class public methods | 7 | Split responsibilities into collaborators |
| File length | 300 lines | Split into modules by cohesion |

---

## 6.5. Refactoring Recipes (Before/After)

### Recipe 1: Nested Loops → Pipeline

```javascript
// BEFORE — O(n²), hard to read
for (const order of orders) {
  for (const item of order.items) {
    if (item.price > 100) result.push(item.name);
  }
}

// AFTER — pipeline (flatMap/filter/map)
const result = orders
  .flatMap(o => o.items)
  .filter(i => i.price > 100)
  .map(i => i.name);
```

### Recipe 2: Branch Chain → Lookup Table

```typescript
// BEFORE — 5+ if/else-if on same axis
if (type === 'A') return handleA();
else if (type === 'B') return handleB();
else if (type === 'C') return handleC();
else if (type === 'D') return handleD();
else return handleDefault();

// AFTER — lookup table
const handlers: Record<string, () => Result> = {
  A: handleA, B: handleB, C: handleC, D: handleD,
};
return (handlers[type] ?? handleDefault)();
```

### Recipe 3: State Branching → State Pattern

```typescript
// BEFORE — status checks scattered everywhere
if (status === 'draft') { /* draft logic */ }
else if (status === 'confirmed') { /* confirmed logic */ }
else if (status === 'shipped') { /* shipped logic */ }

// AFTER — State pattern
interface OrderState { handle(ctx: OrderContext): void; }
class DraftState implements OrderState { handle(ctx) { /* draft logic */ } }
class ConfirmedState implements OrderState { handle(ctx) { /* confirmed logic */ } }
// Each state handles its own transitions
```

### Recipe 4: Constructor Bloat → Builder

```typescript
// BEFORE — 5+ constructor params
const config = new ServerConfig('localhost', 8080, true, 30000, '/api', true, 'production');

// AFTER — Builder pattern
const config = new ServerConfigBuilder()
  .host('localhost').port(8080)
  .ssl(true).timeout(30000)
  .basePath('/api').env('production')
  .build();
```

### Recipe 5: Switch Cases → Registry

```typescript
// BEFORE — 8+ switch cases
switch (command) {
  case 'start': return startHandler();
  case 'stop': return stopHandler();
  // ... 6 more cases
}

// AFTER — registry pattern
const registry = new Map<string, CommandHandler>();
registry.set('start', startHandler);
registry.set('stop', stopHandler);
// Register at startup, lookup at runtime
return registry.get(command)?.execute() ?? unknownCommand();
```

---

## 7. Self-Check (Run Before Completing Any Code Task)

1. Does each function/class have a single, nameable responsibility?
2. Could I add a new variant without editing existing code?
3. Are dependencies injected, not instantiated internally?
4. Did I check for existing code to reuse before writing new logic?
5. Did I refactor strained code before bolting on new features?
6. Is every function under 40 lines and under 3 params?
7. Are there 3+ branches on one axis that should be a pattern?

---

## 8. Reference Repositories

Study these repos for excellent code structure in each language:

### C++
- [fmtlib/fmt](https://github.com/fmtlib/fmt) (23k) — API design, constexpr, RAII
- [abseil/abseil-cpp](https://github.com/abseil/abseil-cpp) (17k) — Modular structure, StatusOr
- [TheLartians/ModernCppStarter](https://github.com/TheLartians/ModernCppStarter) (5k) — Project template

### C#
- [jasontaylordev/CleanArchitecture](https://github.com/jasontaylordev/CleanArchitecture) (20k) — 4-layer, MediatR CQRS
- [amantinband/clean-architecture](https://github.com/amantinband/clean-architecture) (1.9k) — ErrorOr Result pattern
- [dotnet/eShop](https://github.com/dotnet/eShop) (10k) — Production DDD/CQRS

### TypeScript
- [alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react) (35k) — Feature-based folders
- [supermacro/neverthrow](https://github.com/supermacro/neverthrow) (7k) — Result<T,E> monad
- [Effect-TS/effect](https://github.com/Effect-TS/effect) (14k) — Advanced type programming

### Python
- [cosmicpython/code](https://github.com/cosmicpython/code) (2.6k) — DDD/Clean Architecture textbook
- [pydantic/pydantic](https://github.com/pydantic/pydantic) (27k) — Type system mastery
- [Textualize/textual](https://github.com/Textualize/textual) (35k) — Modern Python 3.11+ idioms

### Multi-Language Patterns
- [RefactoringGuru](https://github.com/RefactoringGuru) — 23 GoF patterns in 8 languages
- [ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) (94k) — Bad/Good pairs

---

## 9. Security Checklist (ECC-Insight)

> Inspired by Everything Claude Code security patterns. Apply across all languages.

### 9.1 Hardcoded Secrets — CRITICAL

Secrets in source = immediate BLOCK.

| Pattern | Severity | Fix |
|---------|:--------:|-----|
| `password = "..."` / `apiKey = "..."` / `secret = "..."` | CRITICAL | Environment variable or secret manager |
| `Bearer <token>` hardcoded | CRITICAL | Fetch from env / vault |
| Private keys (RSA, SSH) committed | CRITICAL | `.gitignore` + rotate compromised keys |
| `.env` files tracked in git | HIGH | `.gitignore` + `.env.example` |

### 9.2 Injection Prevention — CRITICAL

| Type | Bad | Good |
|------|-----|------|
| **SQL** | `"SELECT * FROM t WHERE id=" + id` | Parameterized query / ORM |
| **Shell** | `subprocess.run(cmd, shell=True)` | `subprocess.run([cmd, arg], shell=False)` |
| **Path Traversal** | `open(base + user_input)` | `realpath()` + prefix check |
| **Command** | `system("rm " + filename)` | Validate + whitelist + proper escaping |

### 9.3 Deserialization Safety — CRITICAL

Never deserialize untrusted data with unsafe formats.

- **Python**: `pickle.load()` on untrusted data → use JSON/MessagePack
- **C#**: `BinaryFormatter` → use `System.Text.Json`
- **Java**: `ObjectInputStream` → use Jackson with type validation
- **YAML**: `yaml.load()` → `yaml.safe_load()`

### 9.4 Input Validation Boundaries — HIGH

Validate at system boundaries, trust internal code.

- User input (web forms, CLI args, API requests)
- External API responses
- File uploads (size, type, content)
- Environment variables (type coercion)

Do NOT re-validate inside trusted internal calls — this is defensive programming anti-pattern.

---

## 10. Severity Classification (ECC-Insight)

Unified severity taxonomy for all review layers (L1 design, L2 language idioms, L3 domain safety).

| Severity | Criteria | Review Action | Examples |
|----------|----------|---------------|----------|
| **CRITICAL** | Security vulnerability, data loss risk, crash-inducing | **BLOCK** — Must fix, deployment halted | Hardcoded secrets, SQL injection, use-after-free, MISRA Required violation |
| **HIGH** | SOLID violation, cyclomatic > 20, unhandled errors | **WARNING** — Fix recommended, review cannot pass | God class, deeply nested logic, missing error handling, data race |
| **MEDIUM** | Naming inconsistency, DRY violation, magic numbers | **WARNING** — Improvement suggested, review can pass | Duplicate code, unclear names, missing constants |
| **LOW** | Missing docs, formatting inconsistency | **APPROVE** — Informational only | Missing JSDoc, import order, trailing whitespace |

### Review Report Format

```markdown
## Quality Score: {0-100}/100

### BLOCK (CRITICAL) — Fix required
- [SQ-XXX] Description at file:line
- ...

### WARNING (HIGH / MEDIUM) — Recommended
- [SQ-XXX] Description at file:line
- ...

### APPROVE (LOW) — Informational
- [SQ-XXX] Description at file:line
- ...

### Summary
- Files reviewed: N
- Critical: X | High: Y | Medium: Z | Low: W
- Decision: BLOCK / WARNING / APPROVE
```

---

## 11. AI-Generated Code Audit Rules (ECC-Insight)

> AI-generated code has distinct failure modes. These rules augment standard review.

### 11.1 Mandatory Verification

| Check | Why | How to verify |
|-------|-----|---------------|
| **Error handling sincerity** | AI often adds empty `catch {}` blocks to silence errors | Every catch must log OR re-throw OR handle meaningfully |
| **Resource cleanup paths** | File handles, DB connections, sockets may leak | Trace every resource through all exit paths (happy + error) |
| **Boundary conditions** | Empty input, null, max values often missed | Add explicit tests for empty/null/max |
| **API existence** | AI hallucinates library functions | Verify every import and method call against real docs |
| **Version accuracy** | AI suggests deprecated APIs | Check against current language/framework version |

### 11.2 AI-Specific Anti-Patterns

- **Overbroad try-catch**: Wrapping large blocks with `catch (Exception)` — split into specific exceptions
- **Premature abstraction**: Creating interface/factory for single implementation — YAGNI
- **Unnecessary null checks**: Defensive null checks after framework guarantees non-null
- **Duplicated boilerplate**: AI re-generates same utility rather than extracting
- **Comment rot**: Comments describing pre-AI code that no longer matches

### 11.3 Red Flags in Diffs

- Mass changes across unrelated files in one "fix"
- New dependencies without justification
- Config/lint rule relaxation to "fix" errors
- `// TODO`, `// FIXME`, `// temporary` comments introduced by AI
- Test assertions weakened (`expect(x).toBeDefined()` vs `expect(x).toBe(42)`)
