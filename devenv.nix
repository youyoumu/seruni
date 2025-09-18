{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:
let
  pkgs-unstable = import inputs.nixpkgs-unstable { system = pkgs.stdenv.system; };
  base = pkgs-unstable.appimageTools.defaultFhsEnvArgs;
  fhs = pkgs-unstable.buildFHSEnv (
    base
    // {
      name = "fhs";
      targetPkgs =
        pkgs:
        (base.targetPkgs pkgs)
        ++ (with pkgs; [
          pkg-config
          ncurses
          linuxHeaders
          gcc
        ]);
      profile = "export FHS=1";
      runScript = "bash";
    }
  );

  nix-electron = pkgs.symlinkJoin {
    name = "nix-electron";
    paths = [ pkgs-unstable.electron_38-bin ];
    postBuild = ''
      mv $out/bin/electron $out/bin/nix-electron
    '';
  };
in
{
  env.GREET = "devenv";

  packages = [
    fhs
    nix-electron
  ];
  languages.javascript.enable = true;
  languages.javascript.package = pkgs-unstable.nodejs_22;

  enterShell = ''
    export ELECTRON_SKIP_BINARY_DOWNLOAD=1
    export ELECTRON_BIN=nix-electron
    fish -C "
      which node;
      node --version
    "
    exit
  '';

  # enterShell = ''
  #   fhs -c '
  #     fish -C "
  #       which node;
  #       node --version
  #     " && exit
  #   '
  #   exit
  # '';

}
