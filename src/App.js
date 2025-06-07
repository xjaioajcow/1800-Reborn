import React, { useState } from 'react';
import HomePage from './HomePage';

function App() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(count + 1);

  return (
    <div>
      <h1>Welcome to the App</h1>
      <button onClick={increment}>Click count: {count}</button>
      <HomePage />
    </div>
  );
}

export default App;
