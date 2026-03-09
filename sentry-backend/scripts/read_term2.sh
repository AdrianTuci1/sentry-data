npm run dev > pipeline2.log 2>&1 &
PID=$!
sleep 25
kill $PID
cat pipeline2.log
