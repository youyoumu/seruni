# Root justfile
# Import submodules

mod format './justfiles/format.just'
mod lint './justfiles/lint.just'
mod check './justfiles/check.just'
mod add './justfiles/add.just'
mod run './justfiles/run.just'

devenv:
    devenv shell -v
