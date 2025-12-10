Example: High-school math rubric & grading example (you asked earlier)

Problem: "A toy car travels 30 meters in 5 seconds. What is its average speed in m/s? Show your work."

Generated rubric (JSON):
```
{
  "question_index": 0,
  "goals": [
    {"id":"g1","title":"Correct Solution","description":"Computes average speed correctly as distance/time.","suggested_max_points":5, "student_hint":"Divide distance by time and include units."},
    {"id":"g2","title":"Correct Method","description":"Shows the calculation and the intermediate division step.","suggested_max_points":3, "student_hint":"Show the division 30 ÷ 5."},
    {"id":"g3","title":"Clear Communication","description":"Final answer boxed, units shown 'm/s' and work legible.","suggested_max_points":2, "student_hint":"Write units and box the final value."}
  ],
  "explanation":"Total 10 points. Correct answer 6 m/s gets full correctness points; method shows division step; communication ensures units are present."
}
```

Sample grading output (student wrote 6 but forgot units and had a small scribble):
```
{
 "question_index":0,
 "per_goal":[
  {"id":"g1","points_awarded":5,"max_points":5,"note":"Answer 6 is correct."},
  {"id":"g2","points_awarded":3,"max_points":3,"note":"Method clearly shown."},
  {"id":"g3","points_awarded":0,"max_points":2,"note":"Units missing."}
 ],
 "total_points":8,
 "max_points":10,
 "overall_feedback":"Good work. show your work next time! (units missing)"
}
```

Teacher sees 8/10 colored green, clicks the 0/2 under Clear Communication and sees the goal breakdown and note "Units missing".