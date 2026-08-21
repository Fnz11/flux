import os
import re

tests_dir = "contracts/programs/fbyt-clone-vault/tests"

for root, _, files in os.walk(tests_dir):
    for file in files:
        if file.endswith(".rs"):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            
            new_content = re.sub(
                r'(lockup_period(?:.*?),\n)',
                r'\1        allowed_output_mints: vec![],\n',
                content,
                flags=re.MULTILINE
            )
            
            if new_content != content:
                with open(filepath, "w") as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
