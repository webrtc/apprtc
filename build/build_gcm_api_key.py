#!/usr/bin/python
"""Script for generating a file containing a GCM API key."""

import json
import optparse
import os
import sys

USAGE = """%prog OUT_DIR GCM_API_KEY
Generates a JSON file containing the GCM_API_KEY.

OUT_DIR     Directory to output file gcm_config.json
GCM_API_KEY The GCM API key to be stored. If not specified it will be empty."""


def write_gcm_config_json(out_dir, gcm_api_key):
  path = os.path.join(out_dir, 'gcm_config.json')
  with open(path, 'w') as f:
    f.write(json.dumps({'GCM_API_KEY': gcm_api_key}))

if __name__ == '__main__':
  parser = optparse.OptionParser(USAGE)
  options, args = parser.parse_args()
  if len(args) != 1 and len(args) != 2:
    parser.print_help()
    sys.exit(1)
  write_gcm_config_json(args[0], args[1] if len(args) == 2 else '')
