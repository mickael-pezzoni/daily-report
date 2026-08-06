{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_24
  ];

  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
