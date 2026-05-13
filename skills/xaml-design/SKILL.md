---
name: xaml-design
classification: capability
deprecation-risk: low
domain: wpf
description: |
  XAML UI 디자인/스타일 가이드. ResourceDictionary, DataTemplate, Converter, Style.
  Triggers: XAML design, style, template, ResourceDictionary, converter
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep]
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

# XAML Design Guide

## Style Definition
```xml
<Window.Resources>
    <Style x:Key="PrimaryButton" TargetType="Button">
        <Setter Property="Background" Value="#0078D4"/>
        <Setter Property="Foreground" Value="White"/>
        <Setter Property="Padding" Value="16,8"/>
        <Setter Property="FontSize" Value="14"/>
    </Style>
</Window.Resources>
<Button Style="{StaticResource PrimaryButton}" Content="Click Me"/>
```

## DataTemplate
```xml
<DataTemplate DataType="{x:Type local:SensorData}">
    <StackPanel Orientation="Horizontal">
        <TextBlock Text="{Binding Name}" FontWeight="Bold"/>
        <TextBlock Text="{Binding Value, StringFormat='{}{0:F2}'}" Margin="8,0"/>
    </StackPanel>
</DataTemplate>
```

## ResourceDictionary (Separate file)
```xml
<!-- Resources/Styles.xaml -->
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
    <SolidColorBrush x:Key="AccentBrush" Color="#0078D4"/>
</ResourceDictionary>

<!-- App.xaml -->
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="Resources/Styles.xaml"/>
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

## IValueConverter
```csharp
public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type t, object p, CultureInfo c) =>
        (bool)value ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object value, Type t, object p, CultureInfo c) =>
        (Visibility)value == Visibility.Visible;
}
```
