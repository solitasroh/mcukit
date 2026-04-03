# Modern C++ Structure Rules

Rules for generating/reviewing C++ code. Target C++17+.
C-style idioms and C++03 patterns are defects unless documented.

---

## Resource Management — RAII

Every resource is managed by an object whose destructor releases it.
```cpp
// Bad — manual lifetime, exception-unsafe
auto* conn = new Connection(addr);
conn->open(); conn->close(); delete conn;

// Good — RAII, exception-safe
auto conn = std::make_unique<Connection>(addr);
conn->open(); // destructor handles cleanup on any exit path
```
- `unique_ptr` for sole ownership. `shared_ptr` only when genuinely shared.
- `scoped_lock` for mutexes. Manual `lock()`/`unlock()` is forbidden.
- Raw `new`/`delete` forbidden. Use `make_unique`/`make_shared`.

## Ownership in Signatures

| Signature | Meaning |
|-----------|---------|
| `void f(const Widget& w)` | Observes, does not own |
| `void f(Widget& w)` | Modifies, does not own |
| `void f(std::unique_ptr<Widget> w)` | Takes sole ownership |
| `Widget* f()` | Observer only — caller must not delete |

## Type Safety
```cpp
// Bad
#define MAX_RETRIES 3
enum Color { RED, GREEN, BLUE };
auto x = (int)some_float;

// Good
constexpr int max_retries = 3;
enum class Color { Red, Green, Blue };
auto x = static_cast<int>(some_float);
```
`enum class` over `enum`. `constexpr` over `#define`. `static_assert` for compile-time checks. `std::variant` over `void*`.

## Containers and Algorithms
```cpp
// Bad — raw loop with index
for (size_t i = 0; i < items.size(); ++i)
    if (items[i].active) result.push_back(items[i].name);

// Good — ranges pipeline
std::ranges::copy(items | std::views::filter(&Item::active)
                        | std::views::transform(&Item::name),
                  std::back_inserter(result));
```
`std::array` for fixed-size, `std::vector` for dynamic. `std::string_view` for non-owning strings. Prefer `<algorithm>` and `<ranges>` over hand-rolled loops.

## Move Semantics

- Rule of Zero: no resource → declare no special members.
- Rule of Five: define destructor → define or delete all five.
- Never `std::move` in a `return` — it prevents NRVO.

## Error Handling
```cpp
// Bad — silent swallow
try { parse(input); } catch (...) {}

// Good — typed error propagation
std::expected<Config, ParseError> parse(std::string_view input);
```

| Approach | Use when |
|----------|----------|
| Exceptions | Rare failures, recovery at higher layer |
| `std::optional<T>` | "No value" is normal |
| `std::expected<T,E>` | Caller needs failure reason |

## Templates
```cpp
// Bad — undocumented requirements
template <typename T> void serialize(const T& obj) { obj.to_json(); }

// Good — concept-constrained
template <typename T>
concept Serializable = requires(const T& t) { { t.to_json() } -> std::convertible_to<std::string>; };
template <Serializable T> void serialize(const T& obj) { /* ... */ }
```

## Headers
- IWYU. No transitive include reliance. Forward-declare when possible.
- `#pragma once`. Order: standard -> third-party -> project.

---

## Modern C++17/20 Idioms

**Structured bindings:**
```cpp
// Bad
auto it = config.find("timeout");
if (it != config.end()) use(it->second);
// Good
if (auto [it, inserted] = config.try_emplace("timeout", 30); !inserted)
    use(it->second);
```

**std::optional** for nullable returns:
```cpp
// Bad — returns -1 on miss
int find_index(const std::vector<int>& v, int target);
// Good
std::optional<size_t> find_index(const std::vector<int>& v, int target);
```

**if constexpr:**
```cpp
// Bad — may not compile for non-arithmetic T
template <typename T> std::string to_str(const T& v) {
    if (std::is_arithmetic_v<T>) return std::to_string(v);
}
// Good
template <typename T> std::string to_str(const T& v) {
    if constexpr (std::is_arithmetic_v<T>) return std::to_string(v);
    else return v.serialize();
}
```

**std::span** for non-owning views:
```cpp
// Bad                                  // Good
void process(const int* data, size_t n); void process(std::span<const int> data);
```

**std::format:**
```cpp
// Bad
char buf[128]; snprintf(buf, sizeof(buf), "user=%s count=%d", name, n);
// Good
auto msg = std::format("user={} count={}", name, n);
```

---

## Project Structure
```
project/
  CMakeLists.txt        # project(), add_subdirectory()
  src/                  # implementation files
  include/mylib/        # public API headers
  tests/                # test executables
  lib/                  # vendored dependencies
```
```cmake
# Bad — global paths leak to all targets
include_directories(${CMAKE_SOURCE_DIR}/include)
link_libraries(pthread)

# Good — target-scoped
target_include_directories(mylib PUBLIC include PRIVATE src)
target_link_libraries(mylib PRIVATE Threads::Threads)
```
Public headers under `include/project_name/`. Tests link the library target.

---

## Design Patterns in Modern C++

**Strategy with std::function** (vs virtual hierarchy):
```cpp
// Bad — class hierarchy for one behavior
class Compressor { public: virtual std::vector<uint8_t> compress(std::span<const uint8_t>) = 0; };
// Good — callable strategy
class Archiver {
    std::function<std::vector<uint8_t>(std::span<const uint8_t>)> compress_;
public:
    explicit Archiver(decltype(compress_) fn) : compress_(std::move(fn)) {}
};
```

**CRTP** (zero-overhead static polymorphism):
```cpp
template <typename Derived>
struct Serializer {
    std::string serialize() { return static_cast<Derived*>(this)->do_serialize(); }
};
struct JsonSerializer : Serializer<JsonSerializer> {
    std::string do_serialize() { return "{}"; }
};
```

**RAII wrapper for C APIs:**
```cpp
// Bad — forgot fclose on early return
FILE* f = fopen("data.bin", "rb");
// Good
auto f = std::unique_ptr<FILE, decltype(&fclose)>(fopen("data.bin", "rb"), &fclose);
```

**Builder with method chaining:**
```cpp
class QueryBuilder {
    std::string table_, where_;
public:
    QueryBuilder& from(std::string t) { table_ = std::move(t); return *this; }
    QueryBuilder& where(std::string w) { where_ = std::move(w); return *this; }
    std::string build() const { return std::format("SELECT * FROM {} WHERE {}", table_, where_); }
};
auto q = QueryBuilder{}.from("users").where("active=1").build();
```

---

## Anti-Patterns

**God class** — split by single responsibility:
```cpp
// Bad
class Application { void parse(); void render(); void query_db(); void send_email(); };
// Good
class ConfigParser { /* ... */ };
class Renderer { /* ... */ };
```

**`using namespace std` in headers** — pollutes every includer:
```cpp
// Bad (in .h)       // Good (in .cpp)
using namespace std;  using std::string; using std::vector;
```

**Macro overuse:**
```cpp
// Bad
#define SQUARE(x) ((x) * (x))
// Good
constexpr auto square(auto x) { return x * x; }
```

**shared_ptr as default:**
```cpp
// Bad — "just in case"              // Good — upgrade only when proven
auto w = std::make_shared<Widget>(); auto w = std::make_unique<Widget>();
```

---

## Reference Repos

| Repository | Stars | Learn from |
|------------|-------|------------|
| [fmtlib/fmt](https://github.com/fmtlib/fmt) | 23k | API design, constexpr, RAII |
| [abseil/abseil-cpp](https://github.com/abseil/abseil-cpp) | 17k | Modular structure, StatusOr\<T\> |
| [TheLartians/ModernCppStarter](https://github.com/TheLartians/ModernCppStarter) | 5k | CMake project template |
| [nlohmann/json](https://github.com/nlohmann/json) | 49k | ADL pattern, structured bindings |
| [cpp-best-practices/gui_starter_template](https://github.com/cpp-best-practices/gui_starter_template) | 2.5k | Full tooling setup |
