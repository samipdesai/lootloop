fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Push App Store text metadata — description, keywords, categories, URLs (#58)

### ios certs

```sh
[bundle exec] fastlane ios certs
```

Create/sync the App Store distribution cert + profile via match (#59)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build a signed Release .ipa and upload to TestFlight (#59)

### ios list_apps

```sh
[bundle exec] fastlane ios list_apps
```

List the App Store Connect app records (#57 verify)

### ios list_bundle_ids

```sh
[bundle exec] fastlane ios list_bundle_ids
```

List all bundle ids registered to this account (#57 diagnosis)

### ios register_bundle_id

```sh
[bundle exec] fastlane ios register_bundle_id
```

Register the com.lootloop.mobile bundle id (#57)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
