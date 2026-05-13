---
name: dotnet-patterns
classification: capability
deprecation-risk: low
domain: wpf
description: |
  .NET DI/패턴/테스트 가이드. Microsoft.Extensions.DI, xUnit, async/await 패턴.
  Triggers: .NET, C#, DI, dependency injection, xUnit, async, pattern
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
pdca-phase: do
grandfathered: true
---
## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   **grandfathered SKILL** — 잠금 어휘 사용 허용 (Cycle 3 변환). 본문 자체가 도메인 기술입니다.
2. **방법론 본문 — 도메인 중립 (선택)**: 공통 방법론 절이 있다면 `<!-- BEGIN: cycle3-body-neutral -->` 마커로 분리.
3. **도메인 예시 부록 (§A)**: SoT(`policies/locked-vocab.json`)에서 자동 생성.

직접 부록을 편집하지 마세요 — `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

---

# .NET Patterns Guide

## Dependency Injection
```csharp
var services = new ServiceCollection()
    .AddSingleton<ISerialService, SerialService>()
    .AddTransient<MainViewModel>()
    .BuildServiceProvider();
```

## xUnit Testing (ViewModel)
```csharp
public class MainViewModelTests
{
    [Fact]
    public void Increment_ShouldIncreaseCount()
    {
        var vm = new MainViewModel(Mock.Of<IDataService>());
        vm.IncrementCommand.Execute(null);
        Assert.Equal(1, vm.Count);
    }
}
```
ViewModel tests run WITHOUT WPF runtime (key MVVM benefit).

## Async Pattern
```csharp
[RelayCommand]
private async Task LoadAsync()
{
    IsLoading = true;
    try { Data = await _service.GetDataAsync(); }
    finally { IsLoading = false; }
}
```

## Configuration
- .NET 8 WPF: `appsettings.json` (add Microsoft.Extensions.Configuration manually)
- .NET Framework: `App.config` (ConfigurationManager, built-in)
