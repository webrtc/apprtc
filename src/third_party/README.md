# Third-Party Code

This directory contains third party code licensed separate from the rest of the repository. See individual files for licensing details.

These are libraries that are required but not provided by AppEngine.

## Adding and Upgrading

The `requirements.txt` file contains a list of versioned dependencies. Add or upgrade packages as follows,

1. Add the new package or upgrading an existing package version in the `requirements.txt` file.
2. Remove the old package directories from the `third_party` directory. *This step may not be needed depending on your version of pip. There is a [bug](https://github.com/pypa/pip/issues/1489) in some versions of `pip` that causes problems with in-place upgrades.*
3. Install the dependencies by running the following command from the `third_party` parent directory,

```
pip install --target=third_party --upgrade -r third_party/requirements.txt
```

4. After the upgrade is complete you should commit all directories and files that were added/changed in the `third_party` directory.
