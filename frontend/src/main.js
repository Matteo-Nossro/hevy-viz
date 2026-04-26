import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

ChartJS.defaults.color = '#8b949e'
ChartJS.defaults.borderColor = '#2d3742'
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif"
ChartJS.defaults.font.size = 11

createApp(App).mount('#app')
