#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p output
swiftc -parse-as-library tests/ios-contract.swift \
  ios/AtharQuest/AtharQuest/Models/AmbassadorModels.swift \
  ios/AtharQuest/AtharQuest/Services/AmbassadorAPI.swift \
  ios/AtharQuest/AtharQuest/Services/AuthTokenStore.swift \
  -o output/athar-ios-contract
output/athar-ios-contract output/contracts
