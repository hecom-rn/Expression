# Expression

[![npm version](https://img.shields.io/npm/v/@hecom/expression.svg?style=flat)](https://www.npmjs.com/package/@hecom/expression)

这是表达式计算的方法模块。

**接口**：

* `calculate(exprStr, fieldnames, data): any`：计算表达式的值，`exprStr`为表达式，必须是`${...}`格式，`fieldnames`是表达式中应该包含哪些字段名称，不传的话，则所有不是函数的都是字段名称，`data`是业务对象的数据。返回计算结果。
* `analyze(exprStr, fieldnames): array`：解析表达式中包含的字段列表，查找关系内部使用数组来表示字段的层级。