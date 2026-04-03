# Modern C++ Structure Rules

These rules apply when generating or reviewing C++ code.
They target C++11 and later. C-style idioms and C++03 patterns
are treated as defects unless a documented constraint requires them.

---

## Resource Management — RAII Without Exception

Every resource (memory, file handle, socket, lock, handle) is
managed by an object whose destructor releases it. This is not
a suggestion — it is the foundational contract of modern C++.

```cpp
// Bad — manual lifetime, exception-unsafe, leak-prone
auto* conn = new Connection(addr);
conn->open();
// ... if anything throws here, conn leaks
conn->close();
delete conn;

// Good — RAII wrapper, exception-safe by construction
auto conn = std::make_unique<Connection>(addr);
conn->open();
// destructor handles close + dealloc regardless of exit path
```

- `std::unique_ptr` for sole ownership.
- `std::shared_ptr` only when ownership is genuinely shared
  (not as a lazy default).
- `std::lock_guard` or `std::scoped_lock` for mutexes.
  Manual `lock()` / `unlock()` is forbidden.
- Raw `new` / `delete` is forbidden in application code.
  Use `std::make_unique` or `std::make_shared`.

## Ownership Semantics in Function Signatures

Function signatures communicate ownership intent:

| Signature | Meaning |
|-----------|---------|
| `void f(Widget w)` | f takes ownership (value/move) |
| `void f(const Widget& w)` | f observes, does not own |
| `void f(Widget& w)` | f modifies, does not own |
| `void f(std::unique_ptr<Widget> w)` | f takes sole ownership |
| `void f(std::shared_ptr<Widget> w)` | f shares ownership |
| `Widget* f()` returning raw ptr | f does not transfer ownership — observer only |

Never return a raw pointer to a heap-allocated object that the
caller is expected to delete. Return `unique_ptr` instead.

## Type Safety

```cpp
// Bad
#define MAX_RETRIES 3            // macro — no scope, no type
enum Color { RED, GREEN, BLUE }; // leaks into enclosing scope
void* data = get_buffer();       // type-erased, accident-prone
auto x = (int)some_float;        // C-style cast hides intent

// Good
constexpr int MAX_RETRIES = 3;          // typed, scoped
enum class Color { Red, Green, Blue };  // scoped, no implicit conversion
std::variant<Buffer, Error> data = get_buffer();
auto x = static_cast<int>(some_float);  // explicit intent
```

- `enum class` over plain `enum`.
- `nullptr` over `NULL` or `0`.
- `constexpr` / `const` / `inline` over `#define`.
- `static_assert` for compile-time invariants.
- `std::variant` or templates over `void*`.
- C++20 `concepts` to constrain template parameters when available.

## Containers and Algorithms

- `std::array` for fixed-size sequences, `std::vector` for dynamic.
  Raw C arrays only in interop or zero-overhead hot paths with a comment.
- `std::string_view` for non-owning string references.
- Prefer `<algorithm>` functions over hand-rolled loops:
  `std::find_if`, `std::transform`, `std::accumulate`, `std::any_of`.
- Range-based `for` as the default loop form.

## Move Semantics

- Design classes to be movable. Move is cheap; copy may not be.
- Rule of Zero: if a class manages no resource directly, declare
  no special member functions. Let the compiler generate them.
- Rule of Five: if you define a destructor (because you manage a
  resource), explicitly define or delete all five special members.
- Do not `std::move` a local variable in a `return` statement —
  it prevents RVO/NRVO.

## Error Handling Strategy

Pick one approach per project and use it consistently.
Mixing exceptions, error codes, and `std::optional` in the same
layer creates ambiguity about who handles what.

| Approach | Use when |
|----------|----------|
| Exceptions | Failures are rare and recovery is at a higher layer |
| `std::optional<T>` | "No value" is a normal outcome, not a failure |
| `std::expected<T,E>` (C++23) | Caller needs the failure reason without exceptions |
| Error codes | Mandated by coding standard (e.g. exceptions disabled) |

Never swallow errors silently. An empty `catch(...)` block or an
unchecked return code is a latent defect.

## Templates and Generics

- Use templates to eliminate duplication across types — not to
  show cleverness.
- Prefer simple function templates over deep class hierarchies
  when behavior differs only by type.
- Document template parameter requirements in a comment or a
  `concept` / `static_assert`.
- Keep template definitions in headers, but consider explicit
  instantiation for heavy templates to reduce compile times.

## Header and Include Discipline

- Include what you use (IWYU). Do not rely on transitive includes.
- Forward-declare when a full definition is not needed (pointers,
  references in headers).
- Use `#pragma once` or include guards. One header, one purpose.
- Organize includes: standard library → third-party → project,
  separated by blank lines.
