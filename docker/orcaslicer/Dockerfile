# Headless slicing sidecar. Built on linuxserver.io's OrcaSlicer image
# rather than extracting the AppImage ourselves - it already has every
# runtime library OrcaSlicer needs (proven by its GUI working), so there's
# no dependency-guessing to do. We drop their GUI/Selkies desktop entirely
# and just exec the CLI binary directly.
FROM lscr.io/linuxserver/orcaslicer:latest

# Silences a benign "XDG_RUNTIME_DIR is invalid or not set" warning from
# orca-slicer on startup - confirmed harmless (exit code 0, correct output)
# without it, but this keeps logs clean.
ENV XDG_RUNTIME_DIR=/tmp

RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs unzip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.js .
# Used by /resolve-settings when no real uploaded file is in context (e.g.
# previewing/creating a Slicing Profile on the Settings page) - the model's
# actual geometry is irrelevant to --export-settings, it just needs a file.
COPY dummy.stl .

EXPOSE 8090
ENTRYPOINT ["node", "/app/server.js"]
