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
in
{
  env.GREET = "devenv";

  packages = [
    fhs
  ];
  languages.javascript.enable = true;
  languages.javascript.package = pkgs-unstable.nodejs_22;

  enterShell = ''
    fhs -c '
      fish -C "
        which node;
        node --version
      " && exit
    '
    exit
  '';

}
