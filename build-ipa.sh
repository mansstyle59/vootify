#!/bin/bash
set -e
echo "🎵 Vootify iOS Build Script"
echo "==========================="
echo ""
echo "📦 Step 1: Building web app..."
npm run build
echo "✅ Web build complete!"
echo ""
echo "📱 Step 2: Syncing to iOS..."
npx cap sync ios
echo "✅ iOS sync complete!"
echo ""
echo "🔨 Step 3: Building iOS app (release)..."
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -derivedDataPath build CODE_SIGN_IDENTITY="\