# -*- coding: utf8 -*-

import os
import re
import glob

for filename in glob.glob('*.vue'):
    filepath = './'+filename
    file = open(filepath, 'r')
    text = file.read()
    file.close()
    templateRegexp = re.compile(r"<template>\n(.*)\n</template>", re.DOTALL)
    template = templateRegexp.search(text).group(1)
    scriptRegexp = re.compile(r"<script>\n(.*)\n</script>", re.DOTALL)
    script = scriptRegexp.search(text).group(1)
    styleRegexp = re.compile(r"<style>\n(.*)\n</style>", re.DOTALL)
    styleMatch = styleRegexp.search(text)
    result = "<script>\n"
    result += script
    result += "\n</script>\n"
    result += "\n<template>\n"
    result += template
    result += "\n</template>\n"
    if styleMatch:
        style = styleMatch.group(1)
        result += "\n<style>\n"
        result += style
        result += "\n</style>\n"
    print(result)
    file = open('./'+filepath, 'w')
    file.write(result)
    file.close()