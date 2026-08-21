import os

directory = '/home/yasfik/projects/flux/contracts/programs/fbyt-clone-vault'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.rs'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                lines = f.readlines()
            
            with open(filepath, 'w') as f:
                for line in lines:
                    if 'allowed_output_mints' in line and 'allowed_output_mints_exactly_four_slots' not in line:
                        continue
                    f.write(line)
