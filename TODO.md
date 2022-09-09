1.try use libgraphics library to build GUI and viusalization.
2.try use clang-format tools to reformat the code.
3.try use g++/clang to build the code and output the result.

------ GUI library--------
pyqt
qt
guilite
Flet

or just use javascript, and use html as interface. In this way, flowchart.js may be a good option.

Clang有一个内置的解释器，或许可以想办法调用那个（parse.h）

1.用flowchart的网页画图，最后用flowchart.js来绘制最终图片

2.导出json，用c++解析json，转换成node.js可以识别的格式
http://open-source-parsers.github.io/jsoncpp-docs/doxygen/index.html

3.绘制流程图，转换成代码。