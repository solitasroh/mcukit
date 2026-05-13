---
name: wpf-mvvm
classification: capability
deprecation-risk: low
domain: wpf
description: |
  WPF MVVM 아키텍처 가이드. CommunityToolkit.Mvvm, DI, 네비게이션 패턴.
  Triggers: WPF, MVVM, ViewModel, CommunityToolkit, ObservableObject, RelayCommand
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
imports:
  - ${PLUGIN_ROOT}/refs/wpf/mvvm-patterns.md
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

# WPF MVVM Guide

## Project Setup (.NET 8)
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.*" />
    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.*" />
  </ItemGroup>
</Project>
```

## ViewModel Pattern (CommunityToolkit.Mvvm)
```csharp
public partial class MainViewModel : ObservableObject
{
    [ObservableProperty]    // Generates public 'Name' property
    private string _name = "";

    [ObservableProperty]
    private int _count;

    [RelayCommand]          // Generates 'IncrementCommand' ICommand
    private void Increment() => Count++;

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        Name = await _dataService.GetNameAsync();
    }

    private readonly IDataService _dataService;
    public MainViewModel(IDataService dataService) => _dataService = dataService;
}
```

## DI Setup (App.xaml.cs)
```csharp
public partial class App : Application
{
    private readonly IServiceProvider _services;

    public App()
    {
        _services = new ServiceCollection()
            .AddSingleton<MainViewModel>()
            .AddSingleton<IDataService, DataService>()
            .BuildServiceProvider();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        var vm = _services.GetRequiredService<MainViewModel>();
        new MainWindow { DataContext = vm }.Show();
    }
}
```

## View Binding
```xml
<Window DataContext="{Binding}">
    <StackPanel>
        <TextBox Text="{Binding Name, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
        <TextBlock Text="{Binding Count}" />
        <Button Content="Increment" Command="{Binding IncrementCommand}" />
    </StackPanel>
</Window>
```

## Key Rules
- NO `{x:Bind}` (UWP/WinUI only)
- ViewModel must NOT reference System.Windows.Controls
- Prism 9.0+ is commercial — use CommunityToolkit.Mvvm for new projects
- Binding errors are runtime-only (check Output window for "Data Error: 40")
