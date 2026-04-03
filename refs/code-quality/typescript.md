# TypeScript / JavaScript Structure Rules

---

## Type Safety

TypeScript exists to catch errors before runtime. Using `any`
defeats that purpose entirely.

- `any` is forbidden. Use `unknown` with type guards when the
  type is truly not known at compile time.
- Annotate function return types explicitly. Inference is fine
  for local variables but unreliable for public API boundaries.
- Discriminated unions must include a literal discriminant field
  so `switch` exhaustiveness checking works.

```typescript
// Bad
function parse(input: any): any { ... }

// Good
function parse(input: unknown): Result<ParsedData, ParseError> {
    if (typeof input !== 'string') {
        return { ok: false, error: new ParseError('expected string') };
    }
    // ...
}
```

## Immutability by Default

Mutable state is the leading source of hard-to-trace bugs in
JavaScript. Default to immutable and opt into mutation only
when there is a measurable reason.

- `const` over `let`. Never use `var`.
- Mark object properties `readonly` or use `as const` for literals.
- Transform collections with `map`, `filter`, `reduce` — do not
  mutate the original with `push`, `splice`, `sort` in place.
- In React, replace state with a new object/array. Never
  `state.items.push(x)`.

## Module Structure

- Named exports by default. Default exports make rename-refactors
  fragile and auto-imports inconsistent.
- One concept per file. A file exporting a class, three helper
  functions, two types, and a constant is doing too much.
- Barrel files (`index.ts`) to define public module boundaries.
  Internal implementation files are not re-exported.
- Zero circular dependencies. If A imports B and B imports A,
  extract the shared dependency into C.

## Error Handling

- Every `Promise` must have a `.catch()` or be inside a
  `try/catch` with `await`.
- Define custom error classes for domain failures. Throwing
  bare `new Error('something')` gives callers no way to
  distinguish error types.
- Avoid swallowing errors. An empty `catch {}` block is a
  latent production incident.

```typescript
// Bad
try { await save(data); } catch (e) { /* silence */ }

// Good
try {
    await save(data);
} catch (error) {
    if (error instanceof ValidationError) {
        showFieldErrors(error.fields);
    } else {
        logger.error('Unexpected save failure', error);
        throw error;  // re-throw what you cannot handle
    }
}
```

## React-Specific (when applicable)

- Components are pure functions of props. Side effects go in
  `useEffect`, data fetching in hooks or server components.
- No business logic in components. Extract it to hooks or
  plain functions that can be tested without rendering.
- Lift state only as high as it needs to go. Global state
  (Zustand, Redux, Context) only for truly app-wide concerns.
- Memoize (`useMemo`, `useCallback`, `React.memo`) only when
  profiling proves a performance problem, not by default.
