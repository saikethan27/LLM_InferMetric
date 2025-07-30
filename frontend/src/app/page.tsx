'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Play, Square, Activity, Zap, HardDrive, Cpu, MessageSquare, Bot, Eye, BarChart3, Database } from 'lucide-react'
import DemoResults from '@/components/demo-results'

interface GPUMetric {
  gpu_index: number
  memory_delta_mb: number
  utilization_delta_percent: number
}

interface RAMMetric {
  memory_delta_gb: number
  percent_delta: number
}

interface ResourceDelta {
  gpu: GPUMetric[]
  ram: RAMMetric
}

interface PeakGPUUsage {
  gpus: Array<{
    index: number
    name: string
    memory_used_mb: number
    memory_total_mb: number
    utilization_percent: number
  }>
  available: boolean
}

interface PeakRAMUsage {
  total_gb: number
  used_gb: number
  available_gb: number
  percent_used: number
}

interface TestMetrics {
  model: string
  created_at: string
  done: boolean
  total_duration: number
  tokens_per_second: number
  prompt_tokens_per_second: number
  total_tokens: number
  total_time_seconds: number
  load_time_seconds: number
  prompt_eval_time_seconds: number
  eval_time_seconds: number
  resource_delta: ResourceDelta
  peak_gpu_usage: PeakGPUUsage
  peak_ram_usage: PeakRAMUsage
}

interface TestResult {
  concurrency: number
  message: string
  model: string
  latency: number
  throughput: number
  promptThroughput: number
  totalTokens: number
  loadTime: number
  evalTime: number
  gpuDelta: number
  ramDelta: number
  peakGpuUtilization: number
  peakGpuVramUsage: number
  peakGpuVramMb: number
  peakCpuRamUsage: number
  peakCpuRamUsageMb: number
  gpuMemoryDelta: number
  ramMemoryDelta: number
}

interface StatusMessage {
  time: number
  msg: string
}

interface SSEMessage {
  type: 'status' | 'content' | 'metrics' | 'DONE'
  message?: string
  content?: string
  metrics?: TestMetrics
}

const AVAILABLE_MODELS = [
  'qwen3:4b-q8_0',
  'llama3:8b-instruct-q4_0',
  'mistral:7b-instruct-v0.2-q4_0',
  'phi3:mini-4k-instruct-q4_0'
]

type ViewType = 'dashboard' | 'demo' | 'history'

export default function LLMLoadTestDashboard() {
  const [view, setView] = useState<ViewType>('dashboard')
  const [apiUrl, setApiUrl] = useState('http://localhost:8000/chat/stream')
  const [message, setMessage] = useState('Hello, how are you today?')
  const [model, setModel] = useState('qwen3:4b-q8_0')
  const [concurrency, setConcurrency] = useState([1])
  const [isRunning, setIsRunning] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])
  const [currentContent, setCurrentContent] = useState('')
  const [progress, setProgress] = useState(0)
  const [maxConcurrency, setMaxConcurrency] = useState(0)

  // Historical data state
  const [historicalResults, setHistoricalResults] = useState<TestResult[]>([])
  const [filterApiUrl, setFilterApiUrl] = useState('all')
  const [filterModel, setFilterModel] = useState('all')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [availableApiUrls, setAvailableApiUrls] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isLoadingFilters, setIsLoadingFilters] = useState(false)

  // Load filter options when switching to history view
  useEffect(() => {
    if (view === 'history' && availableApiUrls.length === 0 && availableModels.length === 0) {
      loadFilterOptions()
    }
  }, [view])

  const startTest = useCallback(async () => {
    if (isRunning) return
    
    setIsRunning(true)
    setStatusMessages([])
    setCurrentContent('')
    setProgress(0)
    setTestResults([])
    
    const results: TestResult[] = []
    const maxConcurrencyLevel = concurrency[0]
    
    for (let n = 1; n <= maxConcurrencyLevel; n++) {
      setProgress((n / maxConcurrencyLevel) * 100)
      
      try {
        const result = await runSingleTest(n)
        results.push(result)
        setTestResults([...results])
        
        setStatusMessages(prev => [...prev, {
          time: Date.now(),
          msg: `Completed test ${n}/${maxConcurrencyLevel}: ${result.latency.toFixed(2)}s latency, ${result.throughput.toFixed(2)} tokens/sec`
        }])
      } catch (error) {
        setStatusMessages(prev => [...prev, {
          time: Date.now(),
          msg: `Failed test ${n}/${maxConcurrencyLevel}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }])
        break
      }
    }
    
    setMaxConcurrency(results.length)
    setIsRunning(false)
    setProgress(100)
    
    // Save results to database
    await saveTestResults(results)
  }, [apiUrl, message, model, concurrency, isRunning])

  const saveTestResults = async (results: TestResult[]) => {
    try {
      const response = await fetch('/api/save-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl,
          model,
          results,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save test results')
      }

      setStatusMessages(prev => [...prev, {
        time: Date.now(),
        msg: `✅ Test results saved to database`
      }])
    } catch (error) {
      console.error('Error saving test results:', error)
      setStatusMessages(prev => [...prev, {
        time: Date.now(),
        msg: `❌ Failed to save test results: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    }
  }

  const loadHistoricalData = async () => {
    setIsLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      if (filterApiUrl && filterApiUrl !== 'all') params.append('apiUrl', filterApiUrl)
      if (filterModel && filterModel !== 'all') params.append('model', filterModel)

      const response = await fetch(`/api/get-metrics?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load historical data')
      }

      const data = await response.json()
      setHistoricalResults(data.results || [])
    } catch (error) {
      console.error('Error loading historical data:', error)
      setStatusMessages(prev => [...prev, {
        time: Date.now(),
        msg: `❌ Failed to load historical data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const loadFilterOptions = async () => {
    setIsLoadingFilters(true)
    try {
      const response = await fetch('/api/get-filter-options')
      if (!response.ok) {
        throw new Error('Failed to load filter options')
      }

      const data = await response.json()
      setAvailableApiUrls(data.apiUrls || [])
      setAvailableModels(data.models || [])
    } catch (error) {
      console.error('Error loading filter options:', error)
      setStatusMessages(prev => [...prev, {
        time: Date.now(),
        msg: `❌ Failed to load filter options: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
      setIsLoadingFilters(false)
    }
  }

  const stopTest = () => {
    setIsRunning(false)
    setProgress(0)
  }

  if (view === 'demo') {
    return <DemoResults onBack={() => setView('dashboard')} />
  }

  if (view === 'history') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="text-center space-y-2 flex-1">
            <h1 className="text-4xl font-bold tracking-tight">Historical Test Results</h1>
            <p className="text-muted-foreground">
              View and filter past test results from the database
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              variant="outline"
              onClick={() => setView('dashboard')}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingFilters && (
              <div className="text-center text-muted-foreground">
                Loading filter options...
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-api-url">API URL</Label>
                <Select value={filterApiUrl} onValueChange={setFilterApiUrl}>
                  <SelectTrigger>
                    <SelectValue placeholder="All API URLs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All API URLs</SelectItem>
                    {availableApiUrls.map((url) => (
                      <SelectItem key={url} value={url}>
                        {url}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-model">Model</Label>
                <Select value={filterModel} onValueChange={setFilterModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {availableModels.map((modelOption) => (
                      <SelectItem key={modelOption} value={modelOption}>
                        {modelOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Button
                  onClick={loadFilterOptions}
                  disabled={isLoadingFilters}
                  variant="outline"
                  className="flex items-center gap-2 w-full"
                >
                  <Database className="h-4 w-4" />
                  {isLoadingFilters ? 'Loading...' : 'Refresh Options'}
                </Button>
              </div>
              <div className="space-y-2 flex items-end">
                <Button
                  onClick={loadHistoricalData}
                  disabled={isLoadingHistory}
                  className="flex items-center gap-2 w-full"
                >
                  <Eye className="h-4 w-4" />
                  {isLoadingHistory ? 'Loading...' : 'Load Results'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historical Results */}
        {historicalResults.length > 0 && (
          <>
            {/* Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resource Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    GPU Resource Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={historicalResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="gpuDelta" stroke="#8884d8" name="GPU Delta %" />
                      <Line type="monotone" dataKey="peakGpuUtilization" stroke="#82ca9d" name="Peak GPU Util %" />
                      <Line type="monotone" dataKey="peakGpuVramUsage" stroke="#ff7300" name="Peak GPU VRAM %" />
                      <Line type="monotone" dataKey="gpuMemoryDelta" stroke="#ffc658" name="GPU Memory (MB)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Memory Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    RAM Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={historicalResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="ramDelta" stroke="#8884d8" name="RAM Delta %" />
                      <Line type="monotone" dataKey="peakCpuRamUsage" stroke="#82ca9d" name="Peak CPU RAM %" />
                      <Line type="monotone" dataKey="ramMemoryDelta" stroke="#ffc658" name="RAM Memory (GB)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Historical Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>Historical Results Table</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concurrency</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Latency (s)</TableHead>
                        <TableHead>Throughput (tok/s)</TableHead>
                        <TableHead>GPU Delta %</TableHead>
                        <TableHead>RAM Delta %</TableHead>
                        <TableHead>Peak GPU %</TableHead>
                        <TableHead>Peak RAM %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.concurrency}</TableCell>
                          <TableCell>{result.model}</TableCell>
                          <TableCell>{result.latency.toFixed(2)}</TableCell>
                          <TableCell>{result.throughput.toFixed(1)}</TableCell>
                          <TableCell>{result.gpuDelta.toFixed(1)}%</TableCell>
                          <TableCell>{result.ramDelta.toFixed(1)}%</TableCell>
                          <TableCell>{result.peakGpuUtilization?.toFixed(1) || 'N/A'}%</TableCell>
                          <TableCell>{result.peakCpuRamUsage?.toFixed(1) || 'N/A'}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}

        {historicalResults.length === 0 && !isLoadingHistory && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No historical results found. Use the filters above and click "Load Results" to view historical data.</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const runSingleTest = (concurrencyLevel: number): Promise<TestResult> => {
    return new Promise((resolve, reject) => {
      const t0 = performance.now()
      let rawTokens = ''
      
      // Check if it's a streaming endpoint (contains 'stream' or is an Ollama API)
      const isStreamingEndpoint = apiUrl.includes('stream') || apiUrl.includes('ollama') || apiUrl.includes('11434')
      
      if (isStreamingEndpoint) {
        // Handle streaming API (like Ollama)
        handleStreamingAPI(concurrencyLevel, t0, resolve, reject)
      } else {
        // Handle regular REST API
        handleRestAPI(concurrencyLevel, t0, resolve, reject)
      }
    })
  }

  const handleStreamingAPI = (concurrencyLevel: number, startTime: number, resolve: (value: TestResult) => void, reject: (reason?: any) => void) => {
    let rawTokens = ''
    let realMetrics: any = null // Store real metrics when received
    
    const requestBody = {
      message,
      model,
      concurrency: concurrencyLevel
    }

    // Use fetch with POST request and ReadableStream for SSE
    const url = `${apiUrl}?concurrency=${concurrencyLevel}`
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson',
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No reader available')
      }

      let buffer = ''
      
        function readStream(): Promise<void> {
          return reader!.read().then(({ done, value }) => {
            if (done) {
              const tEnd = performance.now()
              const totalTime = (tEnd - startTime) / 1000
              
              // Use real metrics if available, otherwise generate fallback
              if (realMetrics) {
                resolve({
                  concurrency: concurrencyLevel,
                  message,
                  model: realMetrics.model || model,
                  latency: realMetrics.total_time_seconds || totalTime,
                  throughput: realMetrics.tokens_per_second || 0,
                  promptThroughput: realMetrics.prompt_tokens_per_second || 0,
                  totalTokens: realMetrics.total_tokens || rawTokens.split(' ').length,
                  loadTime: realMetrics.load_time_seconds || 0,
                  evalTime: realMetrics.eval_time_seconds || 0,
                  gpuDelta: realMetrics.resource_delta?.gpu[0]?.utilization_delta_percent || 0,
                  ramDelta: realMetrics.resource_delta?.ram?.percent_delta || 0,
                  peakGpuUtilization: realMetrics.peak_gpu_usage?.["peak_gpu_utilization_%"] || 0,
                  peakGpuVramUsage: realMetrics.peak_gpu_usage?.["peak_gpu_vram_usage_%"] || 0,
                  peakGpuVramMb: realMetrics.peak_gpu_usage?.["peak_gpu_vram_mb"] || 0,
                  peakCpuRamUsage: realMetrics.peak_ram_usage?.["peak_cpu_ram_usage_%"] || 0,
                  peakCpuRamUsageMb: realMetrics.peak_ram_usage?.["peak_cpu_ram_usage_mb"] || 0,
                  gpuMemoryDelta: realMetrics.resource_delta?.gpu[0]?.memory_delta_mb || 0,
                  ramMemoryDelta: realMetrics.resource_delta?.ram?.memory_delta_gb || 0
                })
              } else {
                // No real metrics available - reject with error
                reject(new Error('No real metrics received from API. Expected metrics with resource_delta, peak_gpu_usage, and peak_ram_usage.'))
              }
              return
            }          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          
          // Process complete JSON lines (NDJSON format) or SSE format
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                let data: any
                
                // Handle SSE format: "data: {...}"
                if (line.startsWith('data: ')) {
                  const jsonString = line.slice(6) // Remove 'data: ' prefix
                  if (jsonString.trim() === '[DONE]') {
                    // Handle end of stream
                    continue
                  }
                  data = JSON.parse(jsonString)
                } else {
                  // Handle raw JSON
                  data = JSON.parse(line)
                }
                
                // Handle metrics data - store real metrics when received
                if (data.type === 'metrics' && data.resource_delta) {
                  realMetrics = data
                  console.log('🎯 REAL METRICS RECEIVED:', data)
                  setStatusMessages(prev => [...prev, {
                    time: Date.now(),
                    msg: `Concurrency ${concurrencyLevel}: ✅ Real metrics - GPU: ${data.resource_delta?.gpu[0]?.utilization_delta_percent || 0}%, RAM: ${data.resource_delta?.ram?.percent_delta || 0}%`
                  }])
                  continue
                }
                
                // Handle different types of streaming data
                if (data.done) {
                  // Final message - use real metrics if available
                  const tEnd = performance.now()
                  const totalTime = (tEnd - startTime) / 1000
                  
                  if (realMetrics) {
                    // Use stored real metrics
                    console.log('🎯 USING REAL METRICS FOR RESULT:', realMetrics)
                    resolve({
                      concurrency: concurrencyLevel,
                      message,
                      model: realMetrics.model || model,
                      latency: realMetrics.total_time_seconds || totalTime,
                      throughput: realMetrics.tokens_per_second || 0,
                      promptThroughput: realMetrics.prompt_tokens_per_second || 0,
                      totalTokens: realMetrics.total_tokens || rawTokens.split(' ').length,
                      loadTime: realMetrics.load_time_seconds || 0,
                      evalTime: realMetrics.eval_time_seconds || 0,
                      gpuDelta: realMetrics.resource_delta?.gpu[0]?.utilization_delta_percent || 0,
                      ramDelta: realMetrics.resource_delta?.ram?.percent_delta || 0,
                      peakGpuUtilization: realMetrics.peak_gpu_usage?.["peak_gpu_utilization_%"] || 0,
                      peakGpuVramUsage: realMetrics.peak_gpu_usage?.["peak_gpu_vram_usage_%"] || 0,
                      peakGpuVramMb: realMetrics.peak_gpu_usage?.["peak_gpu_vram_mb"] || 0,
                      peakCpuRamUsage: realMetrics.peak_ram_usage?.["peak_cpu_ram_usage_%"] || 0,
                      peakCpuRamUsageMb: realMetrics.peak_ram_usage?.["peak_cpu_ram_usage_mb"] || 0,
                      gpuMemoryDelta: realMetrics.resource_delta?.gpu[0]?.memory_delta_mb || 0,
                      ramMemoryDelta: realMetrics.resource_delta?.ram?.memory_delta_gb || 0
                    })
                  } else if (data.type === 'metrics' && data.resource_delta) {
                    // Metrics came with done=true
                    console.log('🎯 USING REAL METRICS FROM DONE MESSAGE:', data)
                    resolve({
                      concurrency: concurrencyLevel,
                      message,
                      model: data.model || model,
                      latency: data.total_time_seconds || totalTime,
                      throughput: data.tokens_per_second || 0,
                      promptThroughput: data.prompt_tokens_per_second || 0,
                      totalTokens: data.total_tokens || rawTokens.split(' ').length,
                      loadTime: data.load_time_seconds || 0,
                      evalTime: data.eval_time_seconds || 0,
                      gpuDelta: data.resource_delta.gpu[0]?.utilization_delta_percent || 0,
                      ramDelta: data.resource_delta.ram.percent_delta || 0,
                      peakGpuUtilization: data.peak_gpu_usage?.["peak_gpu_utilization_%"] || 0,
                      peakGpuVramUsage: data.peak_gpu_usage?.["peak_gpu_vram_usage_%"] || 0,
                      peakGpuVramMb: data.peak_gpu_usage?.["peak_gpu_vram_mb"] || 0,
                      peakCpuRamUsage: data.peak_ram_usage?.["peak_cpu_ram_usage_%"] || 0,
                      peakCpuRamUsageMb: data.peak_ram_usage?.["peak_cpu_ram_usage_mb"] || 0,
                      gpuMemoryDelta: data.resource_delta.gpu[0]?.memory_delta_mb || 0,
                      ramMemoryDelta: data.resource_delta.ram.memory_delta_gb || 0
                    })
                  } else {
                    // No real metrics available - reject with error
                    console.log('⚠️ NO REAL METRICS - CANNOT PROCEED:', data)
                    reject(new Error('No real metrics received from API. Expected done=true message with resource_delta, peak_gpu_usage, and peak_ram_usage.'))
                  }
                  return
                } else if (data.message?.content) {
                  // Handle content streaming
                  rawTokens += data.message.content
                  setCurrentContent(rawTokens)
                } else if (data.content) {
                  // Alternative content format
                  rawTokens += data.content
                  setCurrentContent(rawTokens)
                }
              } catch (error) {
                console.error('Error parsing streaming response:', error)
              }
            }
          }
          
          return readStream()
        })
      }
      
      return readStream()
    })
    .catch(error => {
      console.error('Streaming API request failed:', error)
      reject(error)
    })

    // Timeout after 60 seconds
    setTimeout(() => {
      reject(new Error('Test timeout'))
    }, 60000)
  }

  const handleRestAPI = (concurrencyLevel: number, startTime: number, resolve: (value: TestResult) => void, reject: (reason?: any) => void) => {
    const requestBody = {
      message,
      model,
      concurrency: concurrencyLevel
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`)
      }
      return response.json()
    })
    .then(data => {
      const tEnd = performance.now()
      const totalTime = (tEnd - startTime) / 1000
      
      // Use real data from REST response - expect the same format as streaming
      if (data.resource_delta && data.peak_gpu_usage && data.peak_ram_usage) {
        resolve({
          concurrency: concurrencyLevel,
          message,
          model: data.model || model,
          latency: data.total_time_seconds || totalTime,
          throughput: data.tokens_per_second || 0,
          promptThroughput: data.prompt_tokens_per_second || 0,
          totalTokens: data.total_tokens || 0,
          loadTime: data.load_time_seconds || 0,
          evalTime: data.eval_time_seconds || 0,
          gpuDelta: data.resource_delta.gpu[0]?.utilization_delta_percent || 0,
          ramDelta: data.resource_delta.ram.percent_delta || 0,
          peakGpuUtilization: data.peak_gpu_usage?.["peak_gpu_utilization_%"] || 0,
          peakGpuVramUsage: data.peak_gpu_usage?.["peak_gpu_vram_usage_%"] || 0,
          peakGpuVramMb: data.peak_gpu_usage?.["peak_gpu_vram_mb"] || 0,
          peakCpuRamUsage: data.peak_ram_usage?.["peak_cpu_ram_usage_%"] || 0,
          peakCpuRamUsageMb: data.peak_ram_usage?.["peak_cpu_ram_usage_mb"] || 0,
          gpuMemoryDelta: data.resource_delta.gpu[0]?.memory_delta_mb || 0,
          ramMemoryDelta: data.resource_delta.ram.memory_delta_gb || 0
        })
      } else {
        reject(new Error('REST API response missing required metrics. Expected resource_delta, peak_gpu_usage, and peak_ram_usage.'))
      }
    })
    .catch(error => {
      console.error('REST API request failed:', error)
      reject(error)
    })

    // Timeout after 60 seconds
    setTimeout(() => {
      reject(new Error('Test timeout'))
    }, 60000)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="text-center space-y-2 flex-1">
          <h1 className="text-4xl font-bold tracking-tight">LLM Load Test Dashboard</h1>
          <p className="text-muted-foreground">
            Test and visualize LLM performance under concurrent load using SSE streaming
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <Button
            variant={view === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={(view as ViewType) === 'history' ? 'default' : 'outline'}
            onClick={() => setView('history' as ViewType)}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            History
          </Button>
          <Button
            variant={(view as ViewType) === 'demo' ? 'default' : 'outline'}
            onClick={() => setView('demo' as ViewType)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Demo Results
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure the load test parameters and start testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">API Endpoint URL</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:3000/api/load-test"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((modelOption) => (
                    <SelectItem key={modelOption} value={modelOption}>
                      {modelOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="concurrency">Max Concurrency: {concurrency[0]}</Label>
              <Slider
                id="concurrency"
                min={1}
                max={10}
                step={1}
                value={concurrency}
                onValueChange={setConcurrency}
                disabled={isRunning}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your test message..."
                className="min-h-[60px]"
                disabled={isRunning}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={startTest}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Run Test
            </Button>
            <Button
              onClick={stopTest}
              disabled={!isRunning}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Test
            </Button>
            {isRunning && (
              <div className="flex items-center gap-2 flex-1">
                <Progress value={progress} className="flex-1" />
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 w-full border rounded-md p-4">
            <div className="space-y-1">
              {statusMessages.map((msg, index) => (
                <div key={index} className="text-sm flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {new Date(msg.time).toLocaleTimeString()}
                  </Badge>
                  <span>{msg.msg}</span>
                </div>
              ))}
              {statusMessages.length === 0 && (
                <p className="text-muted-foreground text-sm">No status messages yet. Start a test to see updates.</p>
              )}
            </div>
          </ScrollArea>
          {currentContent && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Generated Content:</Label>
              <ScrollArea className="h-24 w-full border rounded-md p-2 mt-1">
                <p className="text-sm">{currentContent}</p>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Test Results Summary
            </CardTitle>
            <CardDescription>
              Model: {testResults[0]?.model} | Max concurrency handled: {maxConcurrency} | Total tests: {testResults.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concurrency</TableHead>
                    <TableHead>Latency (s)</TableHead>
                    <TableHead>Throughput (tok/s)</TableHead>
                    <TableHead>Prompt (tok/s)</TableHead>
                    <TableHead>Total Tokens</TableHead>
                    <TableHead>Load Time (s)</TableHead>
                    <TableHead>Eval Time (s)</TableHead>
                    <TableHead>GPU Δ (%)</TableHead>
                    <TableHead>RAM Δ (%)</TableHead>
                    <TableHead>GPU Mem Δ (MB)</TableHead>
                    <TableHead>RAM Mem Δ (GB)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{result.concurrency}</TableCell>
                      <TableCell>{result.latency.toFixed(2)}</TableCell>
                      <TableCell>{result.throughput.toFixed(2)}</TableCell>
                      <TableCell>{result.promptThroughput.toFixed(2)}</TableCell>
                      <TableCell>{result.totalTokens}</TableCell>
                      <TableCell>{result.loadTime.toFixed(2)}</TableCell>
                      <TableCell>{result.evalTime.toFixed(2)}</TableCell>
                      <TableCell>{result.gpuDelta.toFixed(1)}</TableCell>
                      <TableCell>{result.ramDelta.toFixed(1)}</TableCell>
                      <TableCell>{result.gpuMemoryDelta.toFixed(0)}</TableCell>
                      <TableCell>{result.ramMemoryDelta.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Visualizations */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Performance Visualizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="latency" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="latency">Latency</TabsTrigger>
                <TabsTrigger value="throughput">Throughput</TabsTrigger>
                <TabsTrigger value="resources">Resource Usage</TabsTrigger>
                <TabsTrigger value="memory">Memory Usage</TabsTrigger>
                <TabsTrigger value="timing">Timing Breakdown</TabsTrigger>
              </TabsList>
              
              <TabsContent value="latency" className="space-y-4">
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">Latency vs Concurrency</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Latency (seconds)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              
              <TabsContent value="throughput" className="space-y-4">
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">Throughput vs Concurrency</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="throughput" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Token Throughput (tokens/sec)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="promptThroughput" 
                        stroke="#ffc658" 
                        strokeWidth={2}
                        name="Prompt Throughput (tokens/sec)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              
              <TabsContent value="resources" className="space-y-4">
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">GPU Usage vs Concurrency</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis yAxisId="left" orientation="left" label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Memory (MB)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="gpuDelta" 
                        stroke="#ff7300" 
                        strokeWidth={2}
                        name="GPU Utilization Delta (%)"
                        yAxisId="left"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="peakGpuUtilization" 
                        stroke="#ff0000" 
                        strokeWidth={2}
                        name="Peak GPU Utilization (%)"
                        yAxisId="left"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="gpuMemoryDelta" 
                        stroke="#ffa500" 
                        strokeWidth={2}
                        name="GPU Memory Delta (MB)"
                        yAxisId="right"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="memory" className="space-y-4">
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">RAM Usage vs Concurrency</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis yAxisId="left" orientation="left" label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Memory (GB)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="ramDelta" 
                        stroke="#00ff00" 
                        strokeWidth={2}
                        name="RAM Utilization Delta (%)"
                        yAxisId="left"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="peakCpuRamUsage" 
                        stroke="#008000" 
                        strokeWidth={2}
                        name="Peak RAM Usage (%)"
                        yAxisId="left"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ramMemoryDelta" 
                        stroke="#90EE90" 
                        strokeWidth={2}
                        name="RAM Memory Delta (GB)"
                        yAxisId="right"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="timing" className="space-y-4">
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">Timing Breakdown vs Concurrency</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={testResults}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="concurrency" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="loadTime" 
                        fill="#8884d8" 
                        name="Load Time (seconds)"
                      />
                      <Bar 
                        dataKey="evalTime" 
                        fill="#82ca9d" 
                        name="Eval Time (seconds)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}