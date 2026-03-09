# To read the terminal I can check if there's any active screen/tmux or I can just re-run the pipeline manually and capture the output to a file.
npm run dev > pipeline.log 2>&1 &
PID=$!
sleep 30
kill $PID
cat pipeline.log
