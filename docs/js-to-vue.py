# -*- coding: utf8 -*-

import os
import re
import glob

for filename in glob.glob('*.js'):
  if not re.search("Mixin", filename):
    filepath = './'+filename
    file = open(filepath, 'r')
    text = file.read()
    file.close()
    regexp = re.compile(r", *\n +template: ` *\n(.*) *\n+ +`", re.DOTALL)
    template = regexp.search(text).group(1)
    script = regexp.sub('', text)
    result = "<template>\n"
    result += re.sub(r"  (.*)", r"\1", template)
    result += "\n</template>\n"
    result += "\n<script>\n"
    result += re.sub(r"(.*)", r"  \1", script)
    result += "\n</script>\n"
    print(result)
    vueFilename = re.sub(r".js$", ".vue", filename)
    vueFile = open('./'+vueFilename, 'w')
    vueFile.write(result)
    vueFile.close()
    os.remove(filepath)