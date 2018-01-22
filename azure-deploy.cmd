# 2. Hugo in temporary path
& "$Env:DEPLOYMENT_SOURCE/bin/hugo.exe" -s "$Env:DEPLOYMENT_SOURCE/blog" -d "$Env:DEPLOYMENT_TARGET" --log -v

# 3. Move the web.config to the root
#mv "$Env:DEPLOYMENT_SOURCE/web.config" "$Env:DEPLOYMENT_TARGET/public/web.config"