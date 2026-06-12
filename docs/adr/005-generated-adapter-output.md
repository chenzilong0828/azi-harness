# ADR-005：Adapter 输出必须可重新生成

状态：Accepted

## 决策

特定 Agent 的 Skill 和规则文件属于托管生成输出，由规范化 Core 资产编译产生。

## 原因

业务语义只维护一份，避免不同 Adapter 漂移。用户自定义写入 Project Knowledge 或 Profile
扩展点，不直接修改生成文件。冲突由 hash 和 lock 检测。
