# ADR-004：Core 不包含模型 Runtime

状态：Accepted

## 决策

首版不调用模型 API，不实现对话循环、工具调度或 Agent Runtime。

## 原因

Codex、Claude Code、Cursor 等已经承担模型执行。AZI 的价值在于项目协议、流程契约、
适配和验证。保持该边界可以降低耦合、成本和安全风险。
