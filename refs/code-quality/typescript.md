# Modern TypeScript Code Structure Rules

## Type Safety
Never use `any`. Use `unknown` with type guards. Annotate return types on public APIs.
```typescript
// Bad
function parse(input: any): any { return JSON.parse(input); }
// Good
function parse(input: unknown): Result<Config, ParseError> {
  if (typeof input !== "string") return err(new ParseError("expected string"));
  return ok(JSON.parse(input) as Config);
}
```

## Immutability by Default
`const` over `let`. Never `var`. Mark properties `readonly`. Use `map`/`filter`/`reduce`.
```typescript
// Bad
let items: string[] = []; items.push("a");
// Good
const items: readonly string[] = [];
const next = [...items, "a"];
```

## Modern TypeScript 5.x

### `satisfies` — validate without widening
```typescript
// Bad — widened to Record<string, string>
const config: Record<string, string> = { api: "/v1", debug: "true" };
// Good — literal types preserved, still validated
const config = { api: "/v1", debug: "true" } satisfies Record<string, string>;
```

### Const type parameters
```typescript
// Bad — x is string
function first<T extends readonly string[]>(arr: T) { return arr[0]; }
// Good — x is "a"
function first<const T extends readonly string[]>(arr: T) { return arr[0]; }
```

### Template literal types
```typescript
// Bad
type Route = string;
// Good — pattern enforced at compile time
type Route = `/${string}`;
type EventName = `on${Capitalize<string>}`;
```

### `using` for resource cleanup
```typescript
// Bad — manual cleanup, easy to forget on error paths
const conn = await getConnection();
try { await query(conn); } finally { conn.close(); }
// Good — automatic disposal via Symbol.asyncDispose
await using conn = await getConnection();
await query(conn); // disposed automatically at block exit
```

### Discriminated unions with exhaustive switch
```typescript
type Shape = { kind: "circle"; radius: number } | { kind: "rect"; w: number; h: number };
// Bad — silently handles future variants
function area(s: Shape): number {
  if (s.kind === "circle") return Math.PI * s.radius ** 2;
  return s.w * s.h;
}
// Good — compiler error if a variant is missed
function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2;
    case "rect":   return s.w * s.h;
    default:       return s satisfies never;
  }
}
```

## Module & Project Structure
Feature-based folders. One concept per file. Named exports only.
```
// Bad — flat, mixed concerns
src/components/LoginForm.tsx
src/utils/auth.ts
// Good — feature-based with barrel files
src/features/auth/index.ts          # barrel = public API
src/features/auth/LoginForm.tsx
src/features/auth/_validateToken.ts  # underscore = internal
src/features/orders/index.ts
```

### Barrel files and path aliases
```typescript
// features/auth/index.ts — only export public API
export { LoginForm } from "./LoginForm";
export type { AuthUser } from "./types";
// _validateToken is internal — NOT exported
```
```typescript
// Bad — deep relative imports
import { validate } from "../../../shared/auth/validate";
// Good — use tsconfig paths: { "@/*": ["./src/*"] }
import { validate } from "@/features/auth";
```
If A imports B and B imports A, extract shared code into C.

## Error Handling Patterns

### Result pattern (neverthrow)
```typescript
// Bad — throw gives caller no type info
async function getUser(id: string): Promise<User> {
  const res = await fetch(`/users/${id}`);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}
// Good — errors in return type
async function getUser(id: string): Promise<Result<User, NotFound | NetworkError>> {
  const res = await fetch(`/users/${id}`);
  if (res.status === 404) return err({ kind: "not-found", id });
  if (!res.ok) return err({ kind: "network", status: res.status });
  return ok(await res.json());
}
```

### Custom error hierarchy
```typescript
// Bad
throw new Error("validation failed");
// Good — discriminant field enables exhaustive matching
abstract class AppError extends Error { abstract readonly kind: string; }
class NotFoundError extends AppError { readonly kind = "not-found"; }
class ValidationError extends AppError {
  readonly kind = "validation";
  constructor(public readonly fields: Record<string, string>) { super("Validation"); }
}
```

### Zod for runtime validation at boundaries
```typescript
// Bad — trust external input
const body = req.body as CreateUserDTO;
// Good — validate at boundary, derive type from schema
const CreateUser = z.object({ name: z.string().min(1), email: z.string().email() });
type CreateUserDTO = z.infer<typeof CreateUser>;
const parsed = CreateUser.safeParse(req.body);
if (!parsed.success) return res.status(400).json(parsed.error.flatten());
```

## React-Specific (when applicable)
Components are pure functions. Extract logic to hooks. Memoize only after profiling.
```typescript
// Bad — logic in component
function OrderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { fetch("/orders").then(r => r.json()).then(setOrders); }, []);
  return <div>{orders.reduce((s, o) => s + o.amount, 0)}</div>;
}
// Good — logic in testable hook
function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { fetch("/orders").then(r => r.json()).then(setOrders); }, []);
  return { orders, total: useMemo(() => orders.reduce((s, o) => s + o.amount, 0), [orders]) };
}
function OrderPage() { const { total } = useOrders(); return <div>{total}</div>; }
```

## Testing Patterns

### Naming: `action_condition_expected` with Arrange-Act-Assert
```typescript
// Bad
test("works", () => { expect(add(1, 2)).toBe(3); });
// Good
test("add_positiveNumbers_returnsSum", () => {
  const a = 1, b = 2;        // Arrange
  const result = add(a, b);   // Act
  expect(result).toBe(3);     // Assert
});
```

### Mock at boundary (interfaces), not implementation
```typescript
// Bad — mocking internal module
vi.mock("./internal/calculateTax", () => ({ calculateTax: () => 10 }));
// Good — inject mock via interface
const mockRepo: UserRepository = {
  findById: vi.fn().mockResolvedValue({ id: "1", name: "Alice" }),
  save: vi.fn(),
};
const service = new UserService(mockRepo);
```

## Reference Repos
| Repo | Stars | Focus |
|------|-------|-------|
| [alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react) | 35k | Feature-based structure, testing |
| [Effect-TS/effect](https://github.com/Effect-TS/effect) | 14k | Advanced type programming |
| [supermacro/neverthrow](https://github.com/supermacro/neverthrow) | 7k | Result monad for TS |
| [stemmlerjs/ddd-forum](https://github.com/stemmlerjs/ddd-forum) | 2.1k | DDD building blocks in TS |
| [labs42io/clean-code-typescript](https://github.com/labs42io/clean-code-typescript) | 9.4k | Bad/Good code pairs |
