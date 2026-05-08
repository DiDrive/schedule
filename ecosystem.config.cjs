module.exports = {
  apps: [
    {
      name: "schedule-web",
      cwd: "D:/manager_vb/projects",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 5000 -H 0.0.0.0",
      interpreter: "D:/NODEJS/node.exe",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}