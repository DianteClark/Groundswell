#!/bin/sh
# Parallel balance run on 2 cores: tools/par.sh N_per_worker diff
N=${1:-20}; D=${2:-3}; S1=${3:-11}; S2=${4:-12}
cd "$(dirname "$0")/.."
OUT=/tmp/b1.json node tools/batch.mjs $N $D $S1 > /tmp/b1.log 2>&1 &
OUT=/tmp/b2.json node tools/batch.mjs $N $D $S2 > /tmp/b2.log 2>&1 &
wait
grep -i "error" /tmp/b1.log /tmp/b2.log | head -3
node tools/merge.mjs /tmp/b1.json /tmp/b2.json
